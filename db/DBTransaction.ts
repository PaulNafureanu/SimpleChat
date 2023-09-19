import { SelectedPick } from "@xata.io/client";
import { Collection, CollectionMap } from "./APIHandler";
import { getXataClient } from "./xata";
const xata = getXataClient();

// Define operation types:

interface QueryOperation {
  type: "query";
  data: object;
  config?: OperationConfig;
}
interface CreateOperation {
  type: "create";
  data: object;
  config?: OperationConfig;
}
interface GetOperation {
  type: "get";
  data: { id: string };
  config?: OperationConfig;
}
interface UpdateOperation {
  type: "update";
  data: object;
  config?: OperationConfig;
}
interface DeleteOperation {
  type: "delete";
  data: object;
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

  // Allowed operations

  private query = (
    operation: QueryOperation & { config: OperationConfig }
  ) => {};

  private create = (
    operation: CreateOperation & { config: OperationConfig }
  ) => {};

  private get = async (
    operation: GetOperation & { config: OperationConfig }
  ) => {
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
  };

  private update = (
    operation: UpdateOperation & { config: OperationConfig }
  ) => {};

  private delete = (
    operation: DeleteOperation & { config: OperationConfig }
  ) => {};

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
transaction.add({ type: "create", data: {} });
transaction.add({ type: "delete", data: {} });
transaction.run();
