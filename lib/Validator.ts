import Joi from "joi";

/**
 * Types used for Joi validation on the server
 */
export interface ValidUserProfile {
  email: string;
  password: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birthday?: Date;
}

const charNotAllowed = /^[^;,'"`*=/]*$/;

class Validator {
  private static options = { abortEarly: false };

  private static userProfileSchema = Joi.object<ValidUserProfile>({
    email: Joi.string().email().pattern(charNotAllowed).required(),
    password: Joi.string().pattern(charNotAllowed).min(5).max(30).required(),
    username: Joi.string().pattern(charNotAllowed).max(16).optional(),
    first_name: Joi.string().alphanum().max(16).optional(),
    last_name: Joi.string().alphanum().max(16).optional(),
    gender: Joi.string().alphanum().max(16).optional(),
    birthday: Joi.string().isoDate().max(30).optional(),
  });

  private static partialUserProfileScheme = Validator.userProfileSchema.keys({
    email: Joi.string().email().pattern(charNotAllowed).optional(),
    password: Joi.string().pattern(charNotAllowed).min(5).max(30).optional(),
  });

  static readonly validate = {
    userProfile: (data: any) =>
      Validator.userProfileSchema.validate(data, Validator.options),
    partialUserProfile: (data: any) =>
      Validator.partialUserProfileScheme.validate(
        data,
        Validator.options
      ) as Joi.ValidationResult<Partial<ValidUserProfile>>,
  };

  static readonly handleError = (error: Joi.ValidationError) => {
    const errorResponse: any = {};
    error.details.forEach((error) => {
      const key = error.context?.key;
      if (key) errorResponse[key] = error.message;
    });
    return { error: errorResponse };
  };

  static readonly Error = Joi.ValidationError;
}

export default Validator;
