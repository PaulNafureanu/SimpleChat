import { ValidUserProfile } from "@/lib/Validator";
import { getXataClient } from "./xata";
import HashGenerator from "@/lib/HashGenerator";
import Serializer from "./Serializer";
const xata = getXataClient();

class UserProfile {
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
