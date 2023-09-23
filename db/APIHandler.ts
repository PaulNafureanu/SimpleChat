import {
  JSONData,
  Repository,
  SelectedPick,
  XataRecord,
} from "@xata.io/client";
import { getXataClient } from "@/db/xata";
import HashGenerator from "@/lib/HashGenerator";
import Validator, { ValidInput } from "./Validator";
import { NextRequest, NextResponse } from "next/server";
import QueryString, { BaseQueryString } from "./QueryString";
const xata = getXataClient();

/**
 * The return type of a query operation resulting in serialized objects.
 */
interface ResultGroup<R> {
  count: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  previous: string | null;
  next: string | null;
  results: JSONData<R>[];
}

interface NextContext {
  params: { id: string };
}

/**
 * Options for APIRouter to determine the collection used and how to use it.
 * Note that the order of items in the collections array matters.
 * The collections should be ordered in the array based on the loading order
 * (first item being the first collection called (to load) from the xata database).
 */
export interface APIRouterOptions {
  collections: Collection[];
  collectionMap: CollectionMap;
  validator: (data: any, update?: boolean) => ValidInput[];
  querystring: (url: string) => Partial<BaseQueryString>;
}

export type Collection = Repository<any & XataRecord>;

/**
 * Collection relationship useful to determine the loading order and selective loading.
 * (A way to tell based on which collection, another collection should be loaded)
 */
export interface CollectionMap {
  fromCollectionID: number;
  loadCollectionIDs: number[];
  usingKeys: string[];
}

// TODO: Revert/undo in case of an error
// TODO: Need Auth Module + permisions (admin, user) + authentication by permissions and TokenGenerator

/**
 * APIHandler is an abstraction wrapper class over the xata database for getting,
 * creating, updating and deleting items in a database table.
 *
 * It automatically maps the database operations onto the REST API routes, as follows:
 *
 * For endpoints like: /collection
 *
 * 1. GET (query method) - get all or a subset of all items in the collection.
 * 2. POST (create method)- create a new item in the collection.
 *
 * For endpoints like: /collection/{id}
 *
 * 3. GET (get method) - get an item in a collection.
 * 4. PUT (update method) - update an item in a collection.
 * 5. DELETE (delete method) - delete an item in a collection.
 *
 */
class APIHandler {
  private static SensitiveFields = {
    toHash: ["password"],
    toRemove: ["password", "user", "xata"],
  };

  private static methods = [
    "query",
    "create",
    "get",
    "update",
    "delete",
  ] as const;

  public static options = {
    UserProfile: {
      collections: [xata.db.Profiles, xata.db.Users],
      collectionMap: {
        fromCollectionID: 0,
        loadCollectionIDs: [1],
        usingKeys: ["user"],
      },
      validator: Validator.useValidator("userProfile"),
      querystring: QueryString.getQuery.userProfile,
    },
    Category: {},
    Conversation: {},
    Message: {},
  };

  private collections;
  private validator;
  private querystring;
  private collectionMap;
  public constructor(options: APIRouterOptions) {
    this.collections = options.collections;
    this.validator = options.validator;
    this.querystring = options.querystring;
    this.collectionMap = options.collectionMap;
  }

  public query = async (url: string) => {
    try {
      // url without search queries params
      const cleanUrl = url.split("?")[0];

      // Define the search query params
      const query = this.querystring(url);
      let { page, size } = query;
      if (!page || page < 1) page = 1;
      if (!size || size < 1) size = 20;

      // Get the objects from the database
      const pagination = { size: size + 1, offset: (page - 1) * size };
      // [object][components]
      let components: Readonly<SelectedPick<any, ["*"]>>[][] =
        await this.handleCollections.query(pagination);

      // Compute the hasPreviousPage, hasNextPage flags and size of the current page
      const hasPreviousPage = page - 1 > 0;
      const hasNextPage = components.length > size;
      const count = hasNextPage ? components.length - 1 : components.length;

      // Define the URL for the previous page
      const prevQuery = { ...query, page: page - 1 };
      const previous = hasPreviousPage
        ? QueryString.getURL(prevQuery, cleanUrl)
        : null;

      // Define the URL for the next page
      const nextQuery = { ...query, page: page + 1 };
      const next = hasNextPage ? QueryString.getURL(nextQuery, cleanUrl) : null;

      // Serialize objects (component by component)
      const serializedComponents = components.map((objectComponents) => {
        const serializedObjectComponents = objectComponents.map((component) =>
          component.toSerializable()
        );

        // Combine the related components to form the serialized objects
        return serializedObjectComponents.reduce((prev, curr) => {
          return { ...curr, ...prev };
        });
      });

      // Return the collection without sensitive data
      let results: JSONData<any>[] = serializedComponents.map((component) =>
        APIHandler.sensitive.remove(component)
      );
      return {
        count,
        hasPreviousPage,
        hasNextPage,
        previous,
        next,
        results,
      } as ResultGroup<any>;
    } catch (error) {
      return APIHandler.handleErrors(error as Error);
    }
  };

  public create = async (data: any) => {
    try {
      // Validate the user input
      const values = this.validator(data);

      // Hash sensitive fields before inserting them into the xata database
      for (let index = 0; index < values.length; index++) {
        values[index] = await APIHandler.sensitive.hash(values[index]);
      }

      // Create the object, component by component
      const components = await this.handleCollections.create(values);

      // Serialize and combine the serialized components
      const serializedComponents = components.map((component) =>
        component.toSerializable()
      );
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...curr, ...prev };
      });

      // return the object without sensitive keys
      return APIHandler.sensitive.remove(serializedObject);
    } catch (error) {
      return APIHandler.handleErrors(error as Error);
    }
  };

  public get = async (id: string) => {
    try {
      // Get the components of our object
      const components = await this.handleCollections.get(id);

      // Serialize and combine the serialized components
      const serializedComponents = components.map((component) =>
        component.toSerializable()
      );
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...curr, ...prev };
      });

      // return the object without sensitive keys
      return APIHandler.sensitive.remove(serializedObject);
    } catch (error) {
      return APIHandler.handleErrors(error as Error);
    }
  };

  public update = async (id: string, data: any) => {
    try {
      // Validate the user input
      const values = this.validator(data, true);

      // Hash sensitive fields before inserting them into the xata database
      for (let index = 0; index < values.length; index++) {
        values[index] = await APIHandler.sensitive.hash(values[index]);
      }

      // Make a copy of our object
      const components = await this.handleCollections.get(id);

      // Serialize the components
      let serializedComponents = components.map((component) =>
        component.toSerializable()
      );

      // Update the key value pair of the components keeping track of which components got updated
      const collectionsToUpdate = [];
      for (let key in data) {
        for (
          let collectionID = 0;
          collectionID < serializedComponents.length;
          collectionID++
        ) {
          if (key in serializedComponents[collectionID]) {
            serializedComponents[collectionID][key] = (data as any)[key];
            collectionsToUpdate.push(collectionID);
            break;
          }
        }
      }

      // Update the object component by component using the tracker
      for (let index = 0; index < collectionsToUpdate.length; index++) {
        const collectionID = collectionsToUpdate[index];
        await this.collections[collectionID].updateOrThrow(
          serializedComponents[collectionID]
        );
      }

      // Combine the updated components
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...curr, ...prev };
      });

      // return the object without sensitive keys
      return APIHandler.sensitive.remove(serializedObject);
    } catch (error) {
      return APIHandler.handleErrors(error as Error);
    }
  };

  public delete = async (id: string) => {
    try {
      // Make a copy of our object
      const components = await this.handleCollections.get(id);

      // Delete the object component by component:
      for (let index = 0; index < this.collections.length; index++) {
        await this.collections[index].deleteOrThrow(components[index]);
      }

      // Serialize and combine the serialized components
      const serializedComponents = components.map((component) =>
        component.toSerializable()
      );
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...curr, ...prev };
      });

      // return the object without sensitive keys
      return APIHandler.sensitive.remove(serializedObject);
    } catch (error) {
      return APIHandler.handleErrors(error as Error);
    }
  };

  // Useful functions to handle the work with multiple collections
  private handleCollections = {
    query: async (pagination: object) => {
      // [object][components]
      let components: Readonly<SelectedPick<any, ["*"]>>[][] = [];
      const { fromCollectionID, loadCollectionIDs, usingKeys } =
        this.collectionMap;

      // Load the components from the main collection
      const mainComponents = await this.collections[fromCollectionID].getMany({
        pagination,
      });

      // Load secondary components one by one for each main component,
      // and group the related components together for an object.
      let objectIndex = 0;
      for (
        let componentIndex = 0;
        componentIndex < mainComponents.length;
        componentIndex++
      ) {
        const component = mainComponents[componentIndex];

        // Groupt related components together in an array
        let objectComponents: Readonly<SelectedPick<any, ["*"]>>[] = [];
        objectComponents[fromCollectionID] = component;

        // Load secondary components and insert them in the above array only if no one is null
        let isNull = false;
        for (let index = 0; index < loadCollectionIDs.length; index++) {
          const collectionID = loadCollectionIDs[index];
          const secondaryComponent = await this.collections[collectionID].read(
            (component as any)[usingKeys[index]]
          );
          if (!secondaryComponent) {
            isNull = true;
            break;
          } else {
            objectComponents[collectionID] = secondaryComponent;
          }
        }

        // If the null flag is not triggered, insert the components
        if (!isNull) {
          components[objectIndex] = objectComponents;
          objectIndex++;
        }
      }
      return components;
    },

    /**
     * The function inserts data across multiple xata data tables (collections) returning an array of components.
     * There is an one-to-one correspondence between the components array and the collections array in the same order.
     * @param values the data you want to be inserted into data tables.
     * @returns a components array representing the rows inserted in the database.
     */
    create: async (values: ValidInput[]) => {
      let components: Readonly<SelectedPick<any, ["*"]>>[] = [];
      const { fromCollectionID, loadCollectionIDs, usingKeys } =
        this.collectionMap;

      // Store the values for the main component to be created
      let completeData = { ...values[fromCollectionID] };

      // Create the secondary components
      for (let index = 0; index < loadCollectionIDs.length; index++) {
        const collectionID = loadCollectionIDs[index];
        components[collectionID] = await this.collections[collectionID].create(
          values[collectionID]
        );
        // Add secondary components to the build of the main component
        (completeData as any)[usingKeys[index]] = components[collectionID];
      }

      // Create the main component
      components[fromCollectionID] = await this.collections[
        fromCollectionID
      ].create(completeData);

      return components;
    },

    /**
     * The function returns a single meaningful object spread across multiple database tables (collections),
     * in the form of an array of components (distinct rows from different database tables).
     * There is an one-to-one correspondence between the components array and the collections array in the same order.
     * @param id the string identifier for the object
     * @returns a components array representing an aggregation of multiple rows from data tables.
     */
    get: async (id: string) => {
      let components: Readonly<SelectedPick<any, ["*"]>>[] = [];
      const { fromCollectionID, loadCollectionIDs, usingKeys } =
        this.collectionMap;

      //Load the component from the main collection
      components[fromCollectionID] = await this.collections[
        fromCollectionID
      ].readOrThrow(id);

      //Load secondary components
      for (let index = 0; index < loadCollectionIDs.length; index++) {
        const collectionID = loadCollectionIDs[index];
        components[collectionID] = await this.collections[
          collectionID
        ].readOrThrow((components[fromCollectionID] as any)[usingKeys[index]]);
      }

      // Return the components
      return components;
    },
  };

  public readonly useNext = (method: (typeof APIHandler.methods)[number]) => {
    return async (request: NextRequest, context: NextContext) => {
      try {
        let funct;
        const url = request?.url;
        const id = context?.params?.id;
        switch (method) {
          case "query": {
            funct = async () => await this.query(url);
            break;
          }
          case "create": {
            const data = await request.json();
            funct = async () => await this.create(data);
            break;
          }
          case "get": {
            funct = async () => await this.get(id);
            break;
          }
          case "update": {
            const data = await request.json();
            funct = async () => await this.update(id, data);
            break;
          }
          case "delete": {
            funct = async () => await this.delete(id);
            break;
          }
        }

        const json = await funct();
        return NextResponse.json(json);
      } catch (error) {
        if (error instanceof Validator.Error)
          return NextResponse.json(Validator.handleError(error), {
            status: 400,
          });
        return NextResponse.json((error as Error).message, { status: 500 });
      }
    };
  };

  // Some utility functions to hash and remove sensitive fields
  private static sensitive = {
    // Hash sensitive field values before inserting them into xata database
    hash: async <T extends Partial<ValidInput>>(validInput: T) => {
      const fields = APIHandler.SensitiveFields.toHash;
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        let fieldValue = (validInput as any)[field] as string | undefined;
        if (fieldValue) {
          const hashedFieldValue = await HashGenerator.hash(fieldValue);
          (validInput as any)[field] = hashedFieldValue;
        }
      }
      return validInput;
    },

    // Remote sensitive and null field values before returing them to the client
    remove: (serializedItem: JSONData<any>) => {
      const fields = APIHandler.SensitiveFields.toRemove;
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        delete serializedItem[field];
      }

      // delete falsy values
      for (let key in serializedItem) {
        if (!serializedItem[key]) delete serializedItem[key];
      }

      return serializedItem;
    },
  };

  // functions for handling errors
  private static handleErrors = (error: Error) => {
    if (error instanceof Validator.Error) return Validator.handleError(error);
    return (error as Error).message;
  };
}

export default APIHandler;
