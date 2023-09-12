import { ValidUserProfile } from "@/lib/Validator";
import { getXataClient } from "./xata";
import HashGenerator from "@/lib/HashGenerator";
import Serializer from "./Serializer";
import QueryString from "@/lib/QueryString";

const xata = getXataClient();
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "http://localhost:3000";

interface UserProfileSearchQuery {
  page?: number;
  size?: number;
  search?: string;
  search_precise?: string;
  categories?: string[];
  conversations?: string[];
}
/**
 * A wrapper class around the xata db tables Users and Profiles
 */
class UserProfile {
  static readonly QueryTemplate: UserProfileSearchQuery = {
    page: 0,
    size: 0,
    search: "",
    search_precise: "",
    categories: [""],
    conversations: [""],
  };

  // Get a specific user profile by id
  static readonly get = async (id: string) => {
    // Get the user and profile by profile id
    const profile = await xata.db.Profiles.readOrThrow(id);
    if (!profile.user)
      throw new UserProfile.Error("Profile could not be found.");
    const user = await xata.db.Users.readOrThrow(profile.user);

    // Serialize profile and user, then return
    const serializedProfile = Serializer.profile(profile);
    const serializedUser = Serializer.user(user);
    return { ...serializedProfile, ...serializedUser };
  };

  static readonly getAll = async (
    query: UserProfileSearchQuery
  ): Promise<Collection<UserProfile>> => {
    // Define how the search query will be used
    let { page = 1, size = 20 } = query;
    if (page < 0) page = 1;
    if (size < 0) size = 1;

    const options = {
      pagination: { size: size + 1, offset: (page - 1) * size },
    };

    // Get the user profiles, serialize them and store them in userProfiles
    const userProfiles = [];
    const profiles = await xata.db.Profiles.getMany(options);

    const profilesLen = profiles.length;
    for (let index = 0; index < profilesLen; index++) {
      const userId = profiles[index].user?.id;
      if (!userId) continue;
      const user = await xata.db.Users.read(userId);
      if (!user) continue;
      const serializedProfile = Serializer.profile(profiles[index]);
      const serializedUser = Serializer.user(user);
      userProfiles.push({ ...serializedProfile, ...serializedUser });
    }

    // Compute the hasNextPage flag and the number of elements in the results array
    const hasNextPage = userProfiles.length > size;
    const count = hasNextPage ? userProfiles.length - 1 : userProfiles.length;

    // Define the URI for the next page
    const baseURL = `${SERVER_DOMAIN}/api/profiles`;
    const nextQuery = { ...query, page: page + 1 };
    const next = hasNextPage ? QueryString.defineURL(nextQuery, baseURL) : null;

    // Define the URI for the previous page
    const previousQuery = { ...query, page: page - 1 };
    const previous =
      previousQuery.page > 0
        ? QueryString.defineURL(previousQuery, baseURL)
        : null;

    //Return the collection
    const results = [...userProfiles];
    return { count, hasNextPage, next, previous, results };
  };

  static readonly create = async (value: ValidUserProfile) => {
    // Create a new user
    const hashedPassword = await HashGenerator.hash(value.password);
    const user = await xata.db.Users.create({
      email: value.email,
      password: hashedPassword,
    });

    if (!user.id) throw new UserProfile.Error("User could not be created.");

    // Create a new profile associated with the above user
    try {
      let profileValues: Partial<ValidUserProfile> = { ...value };
      delete profileValues.email;
      delete profileValues.password;
      const profile = await xata.db.Profiles.create({
        ...profileValues,
        categories: [],
        user,
      });

      if (!profile.id || profile.user?.id !== user.id)
        throw new UserProfile.Error("Profile could not be created.");

      // Serialize the new user and profile
      const serializedUser = Serializer.user(user);
      const serializedProfile = Serializer.profile(profile);
      return { ...serializedProfile, ...serializedUser };
    } catch (error) {
      await xata.db.Users.delete(user);
      throw new UserProfile.Error("Profile could not be created.");
    }
  };

  static readonly update = async (
    id: string,
    value: Partial<ValidUserProfile>
  ) => {
    // Check if the profile exists
    const profileCheck = await xata.db.Profiles.readOrThrow(id);
    const userId = profileCheck.user?.id;
    if (!userId) throw new UserProfile.Error("Profile could not be updated.");

    // Create a new hashed password if necessary
    let hashedPassword;
    if (value.password) {
      hashedPassword = await HashGenerator.hash(value.password);
    }

    // Make backup copies
    const profileCopy = profileCheck;
    const userCopy = await xata.db.Users.readOrThrow(userId);

    try {
      // Update the user
      const user = await xata.db.Users.updateOrThrow({
        id: userId,
        email: value.email,
        password: hashedPassword,
      });
      if (!user.id) throw new UserProfile.Error("User could not be created.");

      // Update the profile
      delete value["email"];
      delete value["password"];
      const profile = await xata.db.Profiles.updateOrThrow({ ...value, id });

      // Serialize and return the user profile
      const serializedProfile = Serializer.profile(profile);
      const serializedUser = Serializer.user(user);
      return { ...serializedProfile, ...serializedUser };
    } catch (error) {
      const user = await xata.db.Users.createOrUpdate(userCopy);
      await xata.db.Profiles.createOrUpdate({ ...profileCopy, user });
      throw new UserProfile.Error("Could not update the user profile.");
    }
  };

  static readonly delete = async (id: string) => {
    // Check user profile existence
    const profileCheck = await xata.db.Profiles.readOrThrow(id);
    const userId = profileCheck.user?.id;
    if (!userId) throw new UserProfile.Error("Profile could not be found.");

    // Make backup copies
    const profileCopy = profileCheck;
    const userCopy = await xata.db.Users.readOrThrow(userId);

    // Delete user profile
    try {
      const profile = await xata.db.Profiles.deleteOrThrow(id);
      const user = await xata.db.Users.deleteOrThrow(userId);

      // Serialize and return
      const serializedProfile = Serializer.profile(profile);
      const serializedUser = Serializer.user(user);
      return { ...serializedProfile, ...serializedUser };
    } catch (error) {
      const user = await xata.db.Users.createOrUpdate(userCopy);
      await xata.db.Profiles.createOrUpdate({ ...profileCopy, user });
      throw new UserProfile.Error("Could not delete the user profile.");
    }
  };

  static readonly handleError = (error: Error) => error.message;
  static readonly Error = class UserProfileError extends Error {};
}

export default UserProfile;
