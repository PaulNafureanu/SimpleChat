import { getXataClient } from "./xata";
const xata = getXataClient();

interface Profile {}

class Profiles {
  static get = async () => {
    return await xata.db.Profiles.getMany();
  };

  static create = async () => {};
  static update = async () => {};
  static delete = async () => {};
}

export default Profiles;
