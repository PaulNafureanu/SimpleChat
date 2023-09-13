import { JSONData, Repository, XataRecord } from "@xata.io/client";
import { getXataClient } from "@/db/xata";
import QueryString from "@/lib/QueryString";
import HashGenerator from "@/lib/HashGenerator";
import Validator, { ValidInput, ValidationResult } from "./Validator";
import { NextRequest, NextResponse } from "next/server";
const xata = getXataClient();

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "http://localhost:3000";

/**
 * The base search query
 */
interface SearchQuery {
  page?: number;
  size?: number;
}

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
 */
interface APIRouterOptions<R extends XataRecord> {
  collection: Repository<R>;
  validator: (data: any) => ValidationResult;
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
 */
class APIRouter<R extends XataRecord> {
  private static SensitiveFields = {
    toHash: ["password"],
    toRemove: ["password", "xata"],
  };

  private collection;
  private validator;
  public constructor(options: APIRouterOptions<R>) {
    this.collection = options.collection;
    this.validator = options.validator;
  }

  public query = async (request: NextRequest) => {
    try {
      //TODO: Continue working on parsing the url, creating a template and generating the query
      const endpoint: string = "/api";

      // Define the search query params
      const query = QueryString.define(request.url, { page: 0, size: 0 });

      let { page, size } = query;
      if (!page || page < 1) page = 1;
      if (!size || size < 1) size = 20;

      // Get the items from the database collection
      const pagination = { size: size + 1, offset: (page - 1) * size };
      const items = await this.collection.getMany({ pagination });

      // Compute the hasPreviousPage, hasNextPage flags and size of the current page
      const hasPreviousPage = page - 1 > 0;
      const hasNextPage = items.length > size;
      const count = hasNextPage ? items.length - 1 : items.length;

      // Define the URL for the previous page
      const baseURL = `${SERVER_DOMAIN}${endpoint}`;
      const prevQuery = { ...query, page: page - 1 };
      const previous = hasPreviousPage
        ? QueryString.defineURL(prevQuery, baseURL)
        : null;

      // Define the URI for the next page
      const nextQuery = { ...query, page: page + 1 };
      const next = hasNextPage
        ? QueryString.defineURL(nextQuery, baseURL)
        : null;

      // Serialize items and return them
      const results =
        items.map((item) => {
          const serializedItem = item.toSerializable();
          return APIRouter.sensitive.remove(serializedItem);
        }) || [];
      const json = {
        count,
        hasPreviousPage,
        hasNextPage,
        previous,
        next,
        results,
      } as Collection<R>;
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

      // Create the item
      const item = await this.collection.create({ ...(value as any) });

      // Serialize the item and return it
      const serializedItem = item.toSerializable();
      const json = APIRouter.sensitive.remove(serializedItem);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public get = async (id: string) => {
    try {
      // Get the item
      const item = await this.collection.readOrThrow(id);

      // Serialize the item and return it
      const serializedItem = item.toSerializable();
      const json = APIRouter.sensitive.remove(serializedItem);
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

      // Update the item
      const item = await this.collection.updateOrThrow(id, {
        ...(value as any),
      });

      //Serialize the item and return it
      const serializedItem = item.toSerializable();
      const json = APIRouter.sensitive.remove(serializedItem);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
  };

  public delete = async (id: string) => {
    try {
      // Delete the item
      const item = await this.collection.deleteOrThrow(id);

      // Serialize the item and return it
      const serializedItem = item.toSerializable();
      const json = APIRouter.sensitive.remove(serializedItem);
      return NextResponse.json(json);
    } catch (error) {
      return APIRouter.handleErrors(error as Error);
    }
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

  private static handleErrors = (error: Error) => {
    if (error instanceof Validator.Error)
      return NextResponse.json(Validator.handleError(error), { status: 400 });
    return NextResponse.json((error as Error).message, { status: 500 });
  };
}

export default APIRouter;

const f = async () => {
  const options = {
    collection: xata.db.Categories,
    validator: Validator.validate.category,
  };
  const route = await new APIRouter(options).get("");

  const user = await xata.db.Users.readOrThrow("");
  const userS = user.toSerializable();
};
