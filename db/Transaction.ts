import { SelectedPick } from "@xata.io/client";
import { Collection, CollectionMap } from "./APIHandler";
import { getXataClient } from "./xata";
const xata = getXataClient();

// Define operation types:

interface QueryOperation {
  type: "query";
  data: { pagination: object };
  config?: OperationConfig;
}
interface CreateOperation {
  type: "create";
  data: { values: any[] };
  config?: OperationConfig;
}
interface GetOperation {
  type: "get";
  data: { id: string };
  config?: OperationConfig;
}
interface UpdateOperation {
  type: "update";
  data: { id: string; values: any[] };
  config?: OperationConfig;
}
interface DeleteOperation {
  type: "delete";
  data: { id: string };
  config?: OperationConfig;
}

type Operation =
  | QueryOperation
  | CreateOperation
  | GetOperation
  | UpdateOperation
  | DeleteOperation;

interface OperationConfig {
  collections: Collection[];
  collectionMap: CollectionMap;
}

class Transaction {
  // Default operation configs
  public static configs = {
    UserProfile: {
      collections: [xata.db.Profiles, xata.db.Users],
      collectionMap: {
        fromCollectionID: 0,
        loadCollectionIDs: [1],
        usingKeys: ["user"],
      },
    },
    Category: {},
    Conversation: {},
    Message: {},
  };

  public readonly operations: (Operation | null)[] = [];
  private config?: OperationConfig;
  constructor(config?: OperationConfig) {
    // Init a new transaction with common operation config
    this.config = config;
  }

  /**
   * Methods to verify the creation, deletion and the update of an object.
   */
  private static verify = {
    /**
     * Verifies if the returned components values from the db are identical with the validated values from the client.
     * Useful for the create method that has to raise an error if isValid flag returns false.
     * @param args the components (to check) and values (new values) array as well as the collection id to be verified.
     * @returns true (valid) if the value-keys coincide and false (invalid) otherwise via isValid flag
     */
    byKeys: (args: {
      components: any[];
      values: any[];
      collectionID: number;
    }): { isValid: boolean; key?: string } => {
      const { components, values, collectionID } = args;
      let isValid = true;
      const keys = Object.keys(values[collectionID]);
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        isValid = values[collectionID][key] === components[collectionID][key];
        if (!isValid) return { isValid, key };
      }
      return { isValid };
    },
    /**
     * Checks if an object in a collection exists.
     * Useful for the delete method that has to raise an error if isValid flag returns false.
     * @param args a collection and object.
     * @returns true (valid) if the object does not exist and false (invalid) otherwise via isValid flag
     */
    byReading: (args: {
      collection: Collection;
      object: any;
    }): { isValid: boolean } => {
      const { collection, object } = args;
      const isValid = collection.read(object) === null;
      return { isValid };
    },
  };

  /**
   * The function returns an array of objects spread across multiple database tables (collections),
   * each object in the form of an array of components (distinct rows from different database tables).
   * There is an one-to-one correspondence between the components array and the collections array in the same order.
   * There is no revert back operation to be performed on the database within the method.
   * @param operation contains the options and the configuration on how reading should work.
   * @returns a 2D matrix [object][components] representing an aggregation of multiple rows from data tables forming an array of objects, otherwise a simple empty array.
   */
  private query = async (
    operation: QueryOperation & { config: OperationConfig }
  ) => {
    try {
      // Prepare data
      const { pagination } = operation.data;
      const { collections, collectionMap } = operation.config;
      const { fromCollectionID, loadCollectionIDs, usingKeys } = collectionMap;

      // [object][components]
      let components: Readonly<SelectedPick<any, ["*"]>>[][] = [];

      // Load the components from the main collection
      const mainComponents = await collections[fromCollectionID].getMany({
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
          const secondaryComponent = await collections[collectionID].read(
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
    } catch (error) {
      return [];
    }
  };

  /**
   * The function creates a single meaningful object spread across multiple database tables (collections) and
   * return the object in the form of an array of components (distinct rows from different database tables).
   * There is an one-to-one correspondence between the components array and the collections array in the same order.
   * There is a revert back operation to be performed on the database within the method in case of error.
   * @param operation contains the values and the configuration on how creation on a new object should work.
   * @returns a components array representing an aggregation of multiple rows from data tables, otherwise throws error.
   */
  private create = async (
    operation: CreateOperation & { config: OperationConfig }
  ) => {
    // Prepare data
    const { values } = operation.data;
    const { collections, collectionMap } = operation.config;
    const { fromCollectionID, loadCollectionIDs, usingKeys } = collectionMap;
    let components: Readonly<SelectedPick<any, ["*"]>>[] = [];

    try {
      // Store the values for the main component to be created
      let mainComponentBuild = { ...values[fromCollectionID] };

      // Create the secondary components
      for (let index = 0; index < loadCollectionIDs.length; index++) {
        const collectionID = loadCollectionIDs[index];
        components[collectionID] = await collections[collectionID].create(
          values[collectionID]
        );
        // Add secondary components to the build of the main component
        (mainComponentBuild as any)[usingKeys[index]] =
          components[collectionID];

        // Validate the creation of the secondary component key by key
        const verifySecondary = { components, values, collectionID };
        const { isValid, key } = Transaction.verify.byKeys(verifySecondary);
        if (!isValid) {
          const errorMsg = `Error at creating a new object. The values for the key ${key} does not coincide.`;
          throw new Error(errorMsg);
        }
      }

      // Create the main component
      components[fromCollectionID] = await collections[fromCollectionID].create(
        mainComponentBuild
      );

      // Validate the creation of the main component key by key
      const verifyMain = { components, values, collectionID: fromCollectionID };
      const { isValid, key } = Transaction.verify.byKeys(verifyMain);
      if (!isValid) {
        const errorMsg = `Error at creating a new object. The values for the key ${key} does not coincide after creation.`;
        throw new Error(errorMsg);
      }

      return components;
    } catch (error) {
      // Revert back the changes made in the db by the create method
      for (
        let collectionID = 0;
        collectionID < components.length;
        collectionID++
      ) {
        // If there is a component delete it from the db
        if (components[collectionID]) {
          await collections[collectionID].delete(components[collectionID]);
        }
      }
      // Raise the error
      throw error;
    }
  };

  /**
   * The function returns a single meaningful object spread across multiple database tables (collections),
   * in the form of an array of components (distinct rows from different database tables).
   * There is an one-to-one correspondence between the components array and the collections array in the same order.
   * There is no revert back operation to be performed on the database within the method.
   * @param operation contains the string id and the configuration on how reading should work.
   * @returns a components array representing an aggregation of multiple rows from data tables, otherwise empty array.
   */
  private get = async (
    operation: GetOperation & { config: OperationConfig }
  ) => {
    try {
      // Prepare data
      const { id } = operation.data;
      const { collections, collectionMap } = operation.config;
      const { fromCollectionID, loadCollectionIDs, usingKeys } = collectionMap;
      let components: Readonly<SelectedPick<any, ["*"]>>[] = [];

      //Load the component from the main collection
      components[fromCollectionID] = await collections[
        fromCollectionID
      ].readOrThrow(id);

      //Load secondary components
      for (let index = 0; index < loadCollectionIDs.length; index++) {
        const collectionID = loadCollectionIDs[index];
        components[collectionID] = await collections[collectionID].readOrThrow(
          (components[fromCollectionID] as any)[usingKeys[index]]
        );
      }

      // Return the components
      return components;
    } catch (error) {
      return [];
    }
  };

  /**
   * The function updates a single meaningful object spread across multiple database tables (collections) and
   * return the updated object in the form of an array of components (distinct rows from different database tables).
   * There is an one-to-one correspondence between the components array and the collections array in the same order.
   * There is a revert back operation to be performed on the database within the method in case of error.
   * @param operation contains the string id, the new values and the configuration on how the update should work.
   * @returns a components array representing an aggregation of multiple rows from data tables, otherwise throws error.
   */
  private update = async (
    operation: UpdateOperation & { config: OperationConfig }
  ) => {
    // Prepare data
    const { id, values } = operation.data;
    const { collections } = operation.config;
    let components: Readonly<SelectedPick<any, ["*"]>>[] = [];
    let updatedComponents: Readonly<SelectedPick<any, ["*"]>>[] = [];

    try {
      // Get the components of the object
      components = await this.get({
        type: "get",
        data: { id },
        config: operation.config,
      });

      // Update the object, component by component
      for (
        let collectionID = 0;
        collectionID < collections.length;
        collectionID++
      ) {
        // If there are new values to update in this collection, update the component
        if (values[collectionID]) {
          // Override the component
          const updatedComponent = {
            ...components[collectionID],
            ...values[collectionID],
          };
          // Persist the updated component in the db
          updatedComponents[collectionID] = await collections[
            collectionID
          ].updateOrThrow(updatedComponent);

          //Check if the component's values are updated
          const verifyOptions = {
            components: updatedComponents,
            values,
            collectionID,
          };
          const { isValid, key } = Transaction.verify.byKeys(verifyOptions);
          if (!isValid) {
            const errorMsg = `Error at updating the object. The values for the key ${key} does not coincide after updating.`;
            throw new Error(errorMsg);
          }
        }
      }

      // return updated components
      return components.map((component, collectionID) => {
        if (updatedComponents[collectionID])
          return updatedComponents[collectionID];
        else return component;
      });
    } catch (error) {
      // Revert back the changes made in the db by the update method
      for (
        let collectionID = 0;
        collectionID < updatedComponents.length;
        collectionID++
      ) {
        // If there is an updated component reset it in the db
        if (updatedComponents[collectionID]) {
          await collections[collectionID].update(components[collectionID]);
        }
      }
      // Raise the error
      throw error;
    }
  };

  /**
   * The function deletes a single meaningful object spread across multiple database tables (collections) and
   * return the deleted object in the form of an array of components (distinct rows from different database tables).
   * There is an one-to-one correspondence between the components array and the collections array in the same order.
   * There is a revert back operation to be performed on the database within the method in case of error.
   * @param operation contains the string id and the configuration on how deletion should work.
   * @returns a components array representing an aggregation of multiple rows from data tables, otherwise throws error.
   */
  private delete = async (
    operation: DeleteOperation & { config: OperationConfig }
  ) => {
    // Prepare data
    const { id } = operation.data;
    const { collections } = operation.config;
    let components: Readonly<SelectedPick<any, ["*"]>>[] = [];
    let deletedComponents: Readonly<SelectedPick<any, ["*"]>>[] = [];

    try {
      // Get the components of the object
      components = await this.get({
        type: "get",
        data: { id },
        config: operation.config,
      });

      // Delete the object, component by component:
      for (
        let collectionID = 0;
        collectionID < collections.length;
        collectionID++
      ) {
        // Delete a component
        const component = await collections[collectionID].delete(
          components[collectionID]
        );
        if (component) deletedComponents[collectionID] = component;

        // Check if the component was indeed deleted
        const verifyOptions = {
          collection: collections[collectionID],
          object: components[collectionID],
        };
        const { isValid } = Transaction.verify.byReading(verifyOptions);
        if (!isValid) {
          const errMsg = `Error at deleting an object. A component could not be deleted.`;
          throw new Error(errMsg);
        }
      }

      // Return the deleted components
      return components;
    } catch (error) {
      // Revert back the changes made in the db by the delete method
      for (
        let collectionID = 0;
        collectionID < deletedComponents.length;
        collectionID++
      ) {
        // If there is a deleted component recreate it in the db
        if (deletedComponents[collectionID]) {
          await collections[collectionID].create(components[collectionID]);
        }
      }
      // Raise the error
      throw error;
    }
  };

  /**
   * Add a new operation to the current transaction
   * @param operation the operation to be added
   * @returns the operation id in the operation array
   */
  public readonly add = (operation: Operation) =>
    this.operations.push(operation) - 1;

  /**
   * Remove an operation from the current transaction
   * @param operationID the id of the operation to be removed
   * @returns the removed operation if it is found, otherwise undefined.
   */
  public readonly remove = (operationID: number) => {
    let operation = this.operations[operationID];
    this.operations[operationID] = null;
    // Return the operation if it is found
    if (operation) return { ...operation } as Operation;
    else undefined;
  };

  public readonly run = () => {};
}

export default Transaction;

// Example of a transaction
const transaction = new Transaction(Transaction.configs.UserProfile);
transaction.add({ type: "create", data: { values: [] } });
transaction.add({ type: "delete", data: { id: "" } });
transaction.run();
