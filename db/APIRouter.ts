import {
  JSONData,
  Repository,
  SelectedPick,
  XataRecord,
} from "@xata.io/client";
import { getXataClient } from "@/db/xata";
import HashGenerator from "@/lib/HashGenerator";
import Validator, { ValidInput, ValidationResult } from "./Validator";
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

/**
 * Options for APIRouter to determine the collection used and how to use it.
 * Note that the order of items in the collections array matters.
 * The collections should be ordered in the array based on the loading order
 * (first item being the first collection called (to load) from the xata database).
 */
interface APIRouterOptions {
  collections: Repository<any & XataRecord>[];
  collectionMap: CollectionMap;
  validator: (data: any) => ValidationResult;
  querystring: (url: string) => Partial<BaseQueryString>;
}
/**
 * Collection relationship useful to determine the loading order and selective loading.
 * (A way to tell based on which collection, another collection should be loaded)
 */
interface CollectionMap {
  fromCollectionID: number;
  loadCollectionIDs: number[];
  usingKeys: string[];
}

//TODO: Need support for multiple collections like UserProfile
//TODO: Need Auth Module + permisions (admin, user) + authentication by permissions

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

  public query = async (request: NextRequest) => {
    try {
      const { url } = request; // full url
      const cleanUrl = url.split("?")[0]; // url without search queries params

      // Define the search query params
      const query = this.querystring(url);
      let { page, size } = query;
      if (!page || page < 1) page = 1;
      if (!size || size < 1) size = 20;

      // Get the items from the database collection
      const pagination = { size: size + 1, offset: (page - 1) * size };
      let items: (Readonly<SelectedPick<any, ["*"]>> | null)[][] =
        this.handleCollections.query(pagination);

      // Compute the hasPreviousPage, hasNextPage flags and size of the current page
      const hasPreviousPage = page - 1 > 0;
      const hasNextPage = items.length > size;
      const count = hasNextPage ? items.length - 1 : items.length;

      // Define the URL for the previous page
      const prevQuery = { ...query, page: page - 1 };
      const previous = hasPreviousPage
        ? QueryString.getURL(prevQuery, cleanUrl)
        : null;

      // Define the URI for the next page
      const nextQuery = { ...query, page: page + 1 };
      const next = hasNextPage ? QueryString.getURL(nextQuery, cleanUrl) : null;

      // Serialize items and return them
      let results: JSONData<any>[] = [];
      for (let itemIndex = 0; itemIndex < items[0].length; itemIndex) {
        let serializedItems = [];
        for (
          let collectionIndex = 0;
          collectionIndex < items.length;
          collectionIndex++
        ) {
          let serializedItem =
            items[collectionIndex][itemIndex]?.toSerializable() || null;
          serializedItems.push(serializedItem);
        }

        (results as any)[itemIndex] =
          serializedItems.reduce((prev, curr) => {
            let result = null;
            if (prev && curr) result = { ...prev, curr };
            else if (prev && !curr) result = { ...prev };
            else if (!prev && curr) result = { ...curr };
            return result;
          }) || [];
      }

      const json = {
        count,
        hasPreviousPage,
        hasNextPage,
        previous,
        next,
        results,
      } as Collection<any>;
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public create = async (data: any) => {
    try {
      // Validate the user input
      const { error, value: validInput } = this.validator(data);
      if (error) throw error;

      // Hash sensitive fields before inserting them into the xata database
      const value = await APIRouter.sensitive.hash(validInput);

      // Create the our object component by component
      const components = await this.handleCollections.create(value);

      // Serialize and combine the serialized components
      const serializedComponents = components.map((component) =>
        component.toSerializable()
      );
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...prev, ...curr };
      });

      // return the object without sensitive keys
      const json = APIRouter.sensitive.remove(serializedObject);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
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
        return { ...prev, ...curr };
      });

      // return the object without sensitive keys
      const json = APIRouter.sensitive.remove(serializedObject);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public update = async (id: string, data: any) => {
    try {
      // Validate the user input
      const { error, value: validInput } = this.validator(data);
      if (error) throw error;

      // Hash sensitive fields before inserting them into the xata database
      const value = await APIRouter.sensitive.hash(validInput);

      // Make a copy of our object
      const components = await this.handleCollections.get(id);

      // Serialize the components
      let serializedComponents = components.map((component) =>
        component.toSerializable()
      );

      // Update the key value pair of the components keeping track of which components got updated
      const trackerIDs = [];
      for (let key in value) {
        for (let index = 0; index < serializedComponents.length; index++) {
          if (key in serializedComponents[index]) {
            serializedComponents[index] = (value as any)[key];
            trackerIDs.push(index);
            break;
          }
        }
      }

      // Update the object component by component using the tracker
      trackerIDs.forEach(async (id) => {
        await this.collections[id].updateOrThrow(serializedComponents[id]);
      });

      // Combine the updated components
      const serializedObject = serializedComponents.reduce((prev, curr) => {
        return { ...prev, ...curr };
      });

      // return the object without sensitive keys
      const json = APIRouter.sensitive.remove(serializedObject);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public delete = async (id: string) => {
    try {
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
        return { ...prev, ...curr };
      });

      // return the object without sensitive keys
      const json = APIRouter.sensitive.remove(serializedObject);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  // Useful functions to handle the work with multiple collections
  private handleCollections = {
    query: (pagination: object) => {
      let items: (Readonly<SelectedPick<any, ["*"]>> | null)[][] = []; // [collection][item in collection]
      this.collectionMap.forEach(async (map) => {
        // First, let's load the base collection only if it's not loaded yet
        if (!items[map.fromCollection]) {
          items[map.fromCollection] = await this.collections[
            map.fromCollection
          ].getMany({ pagination });
        }

        //Now, let's load the secondary collections based on the first collection
        items[map.fromCollection].forEach(async (item) => {
          const collectionsToLoad = map.loadCollections.length;
          for (let index = 0; index < collectionsToLoad; index++) {
            let collectionIndex = map.loadCollections[index];
            // If the collection is not yet loaded, create an empty array and load it
            if (!items[collectionIndex]) items[collectionIndex] = [];
            // Otherwise, push the items one by one
            items[collectionIndex].push(
              await this.collections[collectionIndex].read(
                (item as any)[map.usingKeys[index]]
              )
            );
          }
        });
      });
      return items;
    },

    /**
     * The function inserts data across multiple xata data tables (collections) returning an array of components.
     * There is an one-to-one correspondence between the components array and the collections array in the same order.
     * @param data the data you want to be inserted into data tables.
     * @returns a components array representing the rows inserted in the database.
     */
    create: async (data: object) => {
      let components: Readonly<SelectedPick<any, ["*"]>>[] = [];
      const { fromCollectionID, loadCollectionIDs, usingKeys } =
        this.collectionMap;

      // Make a shallow copy
      let completeData = { ...data };

      // Create the secondary components
      loadCollectionIDs.forEach(async (collectionID, index) => {
        components[collectionID] = await this.collections[collectionID].create(
          data
        );
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
    if (error instanceof Validator.Error)
      return NextResponse.json(Validator.handleError(error), { status: 400 });
    return NextResponse.json((error as Error).message, { status: 500 });
  };
}

export default APIRouter;

const f = async () => {
  // How to set the options
  const options = {
    collections: [xata.db.Profiles, xata.db.Users],
    collectionMap: {
      fromCollectionID: 0,
      loadCollectionIDs: [1],
      usingKeys: ["user"],
    },
    validator: Validator.validate.userProfile,
    querystring: QueryString.getQuery.userProfile,
  };

  // Create an instance of APIRouter outside of any route handler functions
  const route = new APIRouter(options);

  // Define the responses for each route hander (returns NextResponse)
  const queryResponse = route.query(new NextRequest(""));
  const createResponse = route.create({});
  const getResponse = route.get("");
  const updateResponse = route.update("", {});
  const deleteResponse = route.delete("");

  const user = await xata.db.Users.readOrThrow("");
  const userS = user.toSerializable();
};
