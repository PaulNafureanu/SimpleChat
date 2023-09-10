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

class UserProfile {
  static readonly QueryTemplate: UserProfileSearchQuery = {
    page: 0,
    size: 0,
    search: "",
    search_precise: "",
    categories: [""],
    conversations: [""],
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

    // Get the user profiles
    const profiles = await xata.db.Profiles.getMany(options);

    // Compute the hasNextPage flag and the number of elements in the results array
    const hasNextPage = profiles.length > size;
    const count = hasNextPage ? profiles.length - 1 : profiles.length;

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

    //Serialize profiles and return the collection
    const results = profiles.map((profile) => Serializer.profile(profile));
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
  };

  static readonly handleError = (error: Error) => error.message;

  static readonly Error = class UserProfileError extends Error {};
}

export default UserProfile;
