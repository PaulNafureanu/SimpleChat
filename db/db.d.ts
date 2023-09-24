import { Repository } from "@xata.io/client";

/** #Common */

/**
 * Type interface for common database tables to perform operations on them.
 */
type Table = Repository<any>;

/**
 * Type interface for the table identifier.
 * The table ID is generally defined as the index position in a table array.
 */
type TableID = number;

/**
 * Type interface for a record (row) in single database table.
 */
type TableRecord = Readonly<SelectedPick<any, ["*"]>>;

/**
 * Type interface for the identifier of a unique record in a database table.
 */
type RecordID = string;

/**
 * Type interface for the name of a table column.
 */
type TableKey = string;

/**
 * Type interface for a single meaningful object spread across one or multiple database tables.
 */
type TableObject = TableRecord[];

/**
 * Type interface for the identifier of a unique object spread across one or multiple database tables.
 */
type ObjectID = string;

/**
 * Type interface for relationships in a table to handle complex objects spread across multiple database tables.
 * The relationship can be one-to-one, one-to-many or many-to-many.
 */
interface TableRelation {
  mainTableID: TableID;
  secondaryTableIDs: TableID[];
  tableKeys: TableKey[];
}

/**
 * Type interface for a table configuration useful to perform operations on complex objects spread accross multiple tables.
 * The table ID, in the table relationship, is defined as the index position in the tables array.
 */
interface TableConfig {
  tables: Table[];
  relation: TableRelation;
}

/** #APIHandler */

/** #Validator */

type ValidInput = {}; //TODO:

/** #Transaction */

/**
 * Type interface for the methods allowed to perform operations on the database tables.
 */
type Methods = "query" | "create" | "get" | "update" | "delete";

/**
 * Data necessary to perform a query operation on a database table.
 */
type QueryData = { pagination: object };

/**
 * Data necessary to perform a create operation on a database table.
 */
type CreateData = { values: ValidInput[] };

/**
 * Data necessary to perform a get operation on a database table.
 */
type GetData = { id: ObjectID };

/**
 * Data necessary to perform an update operation on a database table.
 */
type UpdateData = { id: ObjectID; values: ValidInput[] };

/**
 * Data necessary to perform a delete operation on a database table.
 */
type DeleteData = { id: ObjectID };

/**
 * Data necessary to perform an operation on a database table.
 */
type MethodsData = QueryData | CreateData | GetData | UpdateData | DeleteData;

/**
 * Type interface to define the common properties of a complex database operation involving multiple database tables.
 */
interface BaseOperation<M extends Methods, D extends MethodsData> {
  method: M;
  data: D;
  config: TableConfig;
}

/**
 * Type interface for the operation identifier.
 */
type OperationID = number;

/**
 * Type interface of the query operation.
 */
type QueryOperation = BaseOperation<"query", QueryData>;

/**
 * Type interface of the create operation.
 */
type CreateOperation = BaseOperation<"create", CreateData>;

/**
 * Type interface of the get operation.
 */
type GetOperation = BaseOperation<"get", GetData>;

/**
 * Type interface of the update operation.
 */
type UpdateOperation = BaseOperation<"update", UpdateData>;

/**
 * Type interface of the delete operation.
 */
type DeleteOperation = BaseOperation<"delete", DeleteData>;

/**
 * Type interface for the operations allowed to be performed on database tables.
 */
type Operation =
  | QueryOperation
  | CreateOperation
  | GetOperation
  | UpdateOperation
  | DeleteOperation;

/**
 * Type interface for the options allowed on database table operations.
 */
interface OperationOptions {
  useResultForValues?: OperationID;
}

/**
 * Type interface for the result of an operation on a database table (or tables).
 */
type OperationResult = TableObject | TableObject[];

/**
 * Type interface for the method that performs the operation on the database tables
 */
type OperationMethod<O extends Operation, R extends OperationResult> = (
  operation: O
) => Promise<R>;

/**
 * Type interface for the methods allowed to be performed on a database in a transaction
 */
interface TransactionMethods {
  query: OperationMethod<QueryOperation, TableObject[]>;
  create: OperationMethod<CreateOperation, TableObject>;
  get: OperationMethod<GetOperation, TableObject>;
  update: OperationMethod<UpdateOperation, TableObject>;
  delete: OperationMethod<DeleteOperation, TableObject>;
}
