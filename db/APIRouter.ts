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
interface Collection<R> {
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
  collections: Repository<any & XataRecord>[];
  collectionMap: CollectionMap;
  validator: (data: any) => ValidInput[];
  querystring: (url: string) => Partial<BaseQueryString>;
}
/**
 * Collection relationship useful to determine the loading order and selective loading.
 * (A way to tell based on which collection, another collection should be loaded)
 */
export interface CollectionMap {
  fromCollectionID: number;
  loadCollectionIDs: number[];
  usingKeys: string[];
}

//TODO: Need Auth Module + permisions (admin, user) + authentication by permissions and TokenGenerator

/**
 * APIRouter is an abstraction wrapper class over the xata database for getting,
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
class APIRouter {
  private static SensitiveFields = {
    toHash: ["password"],
    toRemove: ["password", "xata"],
  };

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

  public query = async (request: NextRequest, context: NextContext) => {
    try {
      const { url } = request; // full url
      const cleanUrl = url.split("?")[0]; // url without search queries params

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
        APIRouter.sensitive.remove(component)
      );
      return {
        count,
        hasPreviousPage,
        hasNextPage,
        previous,
        next,
        results,
      } as Collection<any>;
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  // TODO: There is some error is create function
  public create = async (request: NextRequest, context: NextContext) => {
    try {
      // Unpack data from the request
      const data = await request.json();

      // Validate the user input
      const values = this.validator(data);

      // Hash sensitive fields before inserting them into the xata database
      for (let index = 0; index < values.length; index++) {
        values[index] = await APIRouter.sensitive.hash(values[index]);
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
      return APIRouter.sensitive.remove(serializedObject);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public get = async (request: NextRequest, context: NextContext) => {
    try {
      // Unpack data from the request
      const { id } = context.params;

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
      return APIRouter.sensitive.remove(serializedObject);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public update = async (request: NextRequest, context: NextContext) => {
    try {
      // Unpack data from the request
      const data = await request.json();
      const { id } = context.params;

      // Validate the user input
      const values = this.validator(data);

      // Hash sensitive fields before inserting them into the xata database
      for (let index = 0; index < values.length; index++) {
        values[index] = await APIRouter.sensitive.hash(values[index]);
      }

      // Make a copy of our object
      const components = await this.handleCollections.get(id);

      // Serialize the components
      let serializedComponents = components.map((component) =>
        component.toSerializable()
      );

      // Update the key value pair of the components keeping track of which components got updated
      const trackerIDs = [];
      for (let key in data) {
        for (
          let collectionID = 0;
          collectionID < serializedComponents.length;
          collectionID++
        ) {
          if (key in serializedComponents[collectionID]) {
            serializedComponents[collectionID] = (data as any)[key];
            trackerIDs.push(collectionID);
            break;
          }
        }
      }

      // Update the object component by component using the tracker
      trackerIDs.forEach(async (collectionID) => {
        await this.collections[collectionID].updateOrThrow(
          serializedComponents[collectionID]
        );
      });

      // Combine the updated components
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...curr, ...prev };
      });

      // return the object without sensitive keys
      return APIRouter.sensitive.remove(serializedObject);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public delete = async (request: NextRequest, context: NextContext) => {
    try {
      // Unpack data from the request
      const { id } = context.params;

      // Make a copy of our object
      const components = await this.handleCollections.get(id);

      // Delete the object component by component:
      this.collections.forEach(async (collection, index) => {
        await collection.deleteOrThrow(components[index]);
      });

      // Serialize and combine the serialized components
      const serializedComponents = components.map((component) =>
        component.toSerializable()
      );
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...curr, ...prev };
      });

      // return the object without sensitive keys
      return APIRouter.sensitive.remove(serializedObject);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
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
      loadCollectionIDs.forEach(async (collectionID, index) => {
        components[collectionID] = await this.collections[collectionID].create(
          values[collectionID]
        );
        // Add secondary components to the build of the main component
        (completeData as any)[usingKeys[index]] = components[collectionID];
      });

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
      loadCollectionIDs.forEach(async (collectionID, index) => {
        components[collectionID] = await this.collections[
          collectionID
        ].readOrThrow((components[fromCollectionID] as any)[usingKeys[index]]);
      });

      // Return the components
      return components;
    },
  };

  public readonly useNext = (
    method: "query" | "create" | "get" | "update" | "delete"
  ) => {
    const funct = this[method];
    return async (request: NextRequest, context: NextContext) => {
      try {
        const json = await funct(request, context);
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
      APIRouter.SensitiveFields.toHash.forEach(async (field) => {
        let fieldValue = (validInput as any)[field] as string | undefined;
        if (fieldValue) {
          const hashedFieldValue = await HashGenerator.hash(fieldValue);
          (validInput as any)[field] = hashedFieldValue;
        }
      });
      return validInput;
    },

    // Remote sensitive field values before returing them to the client
    remove: (serializedItem: JSONData<any>) => {
      APIRouter.SensitiveFields.toRemove.forEach((field) => {
        delete serializedItem[field];
      });
      return serializedItem;
    },
  };

  // functions for handling errors
  private static handleErrors = (error: Error) => {
    if (error instanceof Validator.Error) return Validator.handleError(error);
    return (error as Error).message;
  };
}

export default APIRouter;

const f = async () => {
  // Create an instance of APIRouter outside of any route handler functions
  const route = new APIRouter(APIRouter.options.UserProfile);

  // Let's assume the request is received:
  const request = new NextRequest("");
  const context = { params: { id: "" } };
  // Define the responses for each route hander (returns NextResponse)
  const queryResponse = route.query(request, context);
  const createResponse = route.create(request, context);
  const getResponse = route.get(request, context);
  const updateResponse = route.update(request, context);
  const deleteResponse = route.delete(request, context);

  const queryNextResponse = route.useNext("query")(request, context);
};
