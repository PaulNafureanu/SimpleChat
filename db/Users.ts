import { getXataClient } from "./xata";
const xata = getXataClient();

interface User {}

class Users {
  static get = async () => {
    return await xata.db.Users.getMany();
  };

  static create = async () => {};
  static update = async () => {};
  static delete = async () => {};
}

export default Users;
