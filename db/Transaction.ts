import {
  GetOperation,
  Operation,
  OperationID,
  OperationOptions,
  OperationResult,
  TableConfig,
  TableObject,
  TableRecord,
  TransactionMethods,
} from "./db";
import { TableConfigs } from "./dbClient";

class Transaction {
  /**
   * The array of operations which the transaction will perform on the database when the run method is called.
   */
  public readonly operations: (Operation | null)[] = [];

  /**
   * The array of operation options for the above operations array that will be used when the run method is called.
   */
  private readonly operationOptions: (OperationOptions | null)[] = [];

  /**
   * An array that will include the results of the operations done on the database when the run method is called.
   */
  public readonly results: OperationResult[] = [];

  /**
   * Private object for the configuration of the transaction.
   */
  private config?: TableConfig;

  /**
   * Constructs a transaction object giving a configuration object.
   * @param config an object specifying the tables used for the transaction and their configuration.
   */
  constructor(config?: TableConfig) {
    this.config = config;
  }

  /**
   * Private methods to perform operations on the database tables.
   */
  private readonly methods: TransactionMethods = {
    /**
     * The query method performs a query operation on the database tables and returns a 2D array of the form [objectIndex][tableID].
     * The 2D matrix is identical with an array of table objects.
     * The method does not perform a revert back in case of error.
     * @param operation a query operation that defines the data and table configuration to be performed on the database.
     * @returns an array of table objects if at least one object is found, otherwise an empty array in case of an error.
     */
    query: async (operation) => {
      // Extract data
      const { pagination } = operation.data;
      const { tables, relation } = operation.config;
      const { mainTableID, secondaryTableIDs, tableKeys } = relation;

      // [objectIndex][tableID]
      let objects: TableObject[] = [];

      try {
        // Load the main records from the main table to start forming the table objects
        const mainRecords = await tables[mainTableID].getMany({ pagination });

        // Load secondary records, one by one for each main record,
        // and group the related records together to form a table object.
        let objectIndex = 0;
        for (
          let recordIndex = 0;
          recordIndex < mainRecords.length;
          recordIndex++
        ) {
          // Get main record
          const mainRecord = mainRecords[recordIndex];

          //Insert the main record in the table object
          let object: TableObject = [];
          object[mainTableID] = mainRecord;

          // Read secondary records and insert them in the above table object, only if no record is null
          let isRecordNull = false;
          for (
            let tableIndex = 0;
            tableIndex < secondaryTableIDs.length;
            tableIndex++
          ) {
            const tableID = secondaryTableIDs[tableIndex];
            const secondaryRecord = await tables[tableID].read(
              (mainRecord as any)[tableKeys[tableIndex]]
            );
            if (!secondaryRecord) {
              isRecordNull = true;
              break;
            } else {
              object[tableID] = secondaryRecord;
            }
          }

          // If the null flag is not triggered, insert the table object in the array
          if (!isRecordNull) {
            objects[objectIndex] = object;
            objectIndex++;
          }
        }

        // Return the table objects
        return objects;
      } catch (error) {
        return [] as TableObject[];
      }
    },

    /**
     * The create method performs a create operation on the database tables and returns an array of the form [tableID].
     * The table record array is identical with a table object.
     * The method does perform a revert back in case of error.
     * @param operation a create operation that defines the data and table configuration to be performed on the database.
     * @returns the table object created if all the table records are created, otherwise an empty array in case of an error.
     */
    create: async (operation) => {
      // Extract data
      const { values } = operation.data;
      const { tables, relation } = operation.config;
      const { mainTableID, secondaryTableIDs, tableKeys } = relation;

      // [tableID]
      let records: TableObject = [];

      try {
        // Store the values for the main record to be created
        let mainRecordBuild = { ...values[mainTableID] };

        // Create the secondary records
        for (
          let tableIndex = 0;
          tableIndex < secondaryTableIDs.length;
          tableIndex++
        ) {
          const tableID = secondaryTableIDs[tableIndex];
          records[tableID] = await tables[tableID].create(values[tableID]);

          // Add secondary record to the build of the main record
          (mainRecordBuild as any)[tableKeys[tableIndex]] = records[tableID];
        }

        // Create the main record now
        records[mainTableID] = await tables[mainTableID].create(
          mainRecordBuild
        );

        // Return the new table object created
        return records;
      } catch (error) {
        return [] as TableObject;
      }
    },

    /**
     * The get method performs a get operation on the database tables and returns an array of the form [tableID].
     * The table record array is identical with a table object.
     * The method does not perform a revert back in case of error.
     * @param operation a get operation that defines the data and table configuration to be performed on the database.
     * @returns a table object if all the table records are found, otherwise an empty array in case of an error.
     */
    get: async (operation) => {
      // Extract data
      const { id } = operation.data;
      const { tables, relation } = operation.config;
      const { mainTableID, secondaryTableIDs, tableKeys } = relation;

      // [tableID]
      let records: TableObject = [];

      try {
        // Read the main record from the main table
        records[mainTableID] = await tables[mainTableID].readOrThrow(id);

        // Read secondary records
        for (
          let tableIndex = 0;
          tableIndex < secondaryTableIDs.length;
          tableIndex++
        ) {
          const tableID = secondaryTableIDs[tableIndex];
          records[tableID] = await tables[tableID].readOrThrow(
            (records[mainTableID] as any)[tableKeys[tableIndex]]
          );
        }

        // Return the table object
        return records;
      } catch (error) {
        return [] as TableObject;
      }
    },

    /**
     * The update method performs a update operation on the database tables and returns an array of the form [tableID].
     * The table record array is identical with a table object.
     * The method does perform a revert back in case of error.
     * @param operation a update operation that defines the data and table configuration to be performed on the database.
     * @returns the table object updated if all the table records are updated, otherwise an empty array in case of an error.
     */
    update: async (operation) => {
      // Extract data
      const { id, values } = operation.data;
      const { tables } = operation.config;

      // [tableID]
      let records: TableObject = [];
      let updatedRecords: TableRecord[] = [];

      try {
        // Get the records from the database
        const getOperation: GetOperation = {
          method: "get",
          data: { id },
          config: operation.config,
        };
        records = await this.methods.get(getOperation);

        // Update the object, record by record
        for (let tablesID = 0; tablesID < tables.length; tablesID++) {
          // If there are new values to update in this collection, define an updated record and update
          if (values[tablesID]) {
            // Override the record
            let updatedRecord = {
              ...records[tablesID],
              ...values[tablesID],
            };

            // Persist the updated record in the database
            updatedRecords[tablesID] = await tables[tablesID].updateOrThrow(
              updatedRecord
            );
          }
        }

        // Return the updated table object
        return records.map((record, tableID) => {
          if (updatedRecords[tableID]) return updatedRecords[tableID];
          else return record;
        });
      } catch (error) {
        return [] as TableObject;
      }
    },

    /**
     * The delete method performs a delete operation on the database tables and returns an array of the form [tableID].
     * The table record array is identical with a table object.
     * The method does perform a revert back in case of error.
     * @param operation a delete operation that defines the data and table configuration to be performed on the database.
     * @returns the table object deleted if all the table records are deleted, otherwise an empty array in case of an error.
     */
    delete: async (operation) => {
      // Extract data
      const { id } = operation.data;
      const { tables } = operation.config;

      // [tableID]
      let records: TableObject = [];

      try {
        // Get the records from the database
        const getOperation: GetOperation = {
          method: "get",
          data: { id },
          config: operation.config,
        };
        records = await this.methods.get(getOperation);

        // Delete the table object, record by record:
        for (let tableID = 0; tableID < tables.length; tableID++) {
          // Delete a record
          await tables[tableID].delete(records[tableID]);
        }

        // Return the deleted table object
        return records;
      } catch (error) {
        return [] as TableObject;
      }
    },
  };

  /**
   * Private methods to verify the persistence of data change done by the operations on the database.
   */
  private readonly verifyPersistence = {
    create: () => {},
    update: () => {},
    delete: () => {},
  };

  /**
   * Private methods to revert back the change made by the operations on the database tables.
   */
  private readonly revertMethods = {
    create: () => {},
    update: () => {},
    delete: () => {},
  };

  /**
   * Public methods for working with database transactions and operations.
   */
  public readonly actions = {
    /**
     * Add a new operation to the current transaction
     * @param operation the operation to be added
     * @returns the operation id from the operation array
     */
    add: (operation: Operation, options?: OperationOptions): OperationID => {
      const operationID = this.operations.push(operation) - 1;
      if (options) this.operationOptions[operationID] = options;
      return operationID;
    },

    /**
     * Remove an operation from the current transaction
     * @param operationID the id of the operation to be removed
     * @returns the removed operation if it is found, otherwise undefined.
     */
    remove: (operationID: OperationID): Operation | undefined => {
      let operation = this.operations[operationID];
      if (operation) {
        this.operations[operationID] = null;
        this.operationOptions[operationID] = null;
        return { ...operation };
      } else return undefined;
    },

    run: async () => {
      for (
        let operationID = 0;
        operationID < this.operations.length;
        operationID++
      ) {
        //Check operation
        let potentialOperation = this.operations[operationID];
        if (!potentialOperation) continue;

        // Check configuration
        const config = potentialOperation.config || this.config;
        if (!config) throw Transaction.Errors.TransactionConfigNotFound;

        // Define operation
        const operation = { ...potentialOperation, config };

        // Use options
        const options = this.operationOptions[operationID];
        const useResult = options?.useResultForValues;
        const values = useResult ? this.results[useResult] : undefined;

        // If the operation was not removed and has config, run it:
        switch (operation.method) {
          case "query": {
            this.results[operationID] = await this.methods.query(operation);
            break;
          }
          case "create": {
            if (values) operation.data.values = values;
            this.results[operationID] = await this.methods.create(operation);
            break;
          }
          case "get": {
            this.results[operationID] = await this.methods.get(operation);
            break;
          }
          case "update": {
            if (values) operation.data.values = values;
            this.results[operationID] = await this.methods.update(operation);
            break;
          }
          case "delete": {
            this.results[operationID] = await this.methods.delete(operation);
            break;
          }
        }
      }
    },
  } as const;

  private static readonly Errors = {
    TransactionConfigNotFound: new Error(
      "Table configurations for the operation is not provided."
    ),
  };
}

export default Transaction;

const transaction = new Transaction(TableConfigs.UserProfile);
