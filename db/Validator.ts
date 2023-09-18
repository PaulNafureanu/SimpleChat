import Joi from "joi";

/**
 * The valid types returned from validation
 */
export interface ValidUserProfile {
  email: string;
  password: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birthday?: string;
  categories?: string[];
}
export interface ValidCategory {
  conversations: string[];
  label: string;
}
export interface ValidConversation {
  profiles: string[];
  messages?: string[];
  label: string;
}
export interface ValidMessage {
  from: string;
  to: string;
  text: string;
  delivered: string;
}
export type ValidInput =
  | ValidUserProfile
  | ValidCategory
  | ValidConversation
  | ValidMessage;

export type ValidationResult<
  V extends Partial<ValidInput> = Partial<ValidInput>
> = Joi.ValidationResult<V>;

/**
 * Validator class used for user input validation on incoming requests.
 */
class Validator {
  private static options = { abortEarly: false };
  private static NotAllowed = /^[^;,'"`*=/]*$/;
  private static ValidationRules = {
    Users: {
      email: Joi.string().email().pattern(Validator.NotAllowed).required(),
      password: Joi.string()
        .pattern(Validator.NotAllowed)
        .min(5)
        .max(30)
        .required(),
    },
    Profiles: {
      username: Joi.string().pattern(Validator.NotAllowed).max(30).optional(),
      first_name: Joi.string().pattern(Validator.NotAllowed).max(30).optional(),
      last_name: Joi.string().pattern(Validator.NotAllowed).max(30).optional(),
      gender: Joi.string().alphanum().max(16).optional(),
      birthday: Joi.string().isoDate().max(30).optional(),
      categories: Joi.array<string>().unique().optional(),
    },
    Chats: {
      profiles: Joi.array<string>().unique().min(1).required(),
      messages: Joi.array<string>().unique().optional(),
    },
    Conversations: {
      label: Joi.string().alphanum().max(30).required(),
    },
    Messages: {
      from: Joi.string().required(),
      to: Joi.string().required(),
      text: Joi.string().required(),
      delivered: Joi.string().isoDate().max(30).required(),
    },
    Categories: {
      conversations: Joi.array<string>().unique().min(1).required(),
      label: Joi.string().alphanum().max(30).required(),
    },
  };

  private static Schema = {
    UserProfile: Joi.object<ValidUserProfile>({
      ...Validator.ValidationRules.Users,
      ...Validator.ValidationRules.Profiles,
    }),
    Category: Joi.object<ValidCategory>({
      ...Validator.ValidationRules.Categories,
    }),
    Conversation: Joi.object<ValidConversation>({
      ...Validator.ValidationRules.Chats,
      ...Validator.ValidationRules.Conversations,
    }),
    Message: Joi.object<ValidMessage>({
      ...Validator.ValidationRules.Messages,
    }),
  };

  private static Keys = {
    Users: Object.keys(Validator.ValidationRules.Users),
    Profiles: Object.keys(Validator.ValidationRules.Profiles),
    Chats: Object.keys(Validator.ValidationRules.Chats),
    Conversations: Object.keys(Validator.ValidationRules.Conversations),
    Messages: Object.keys(Validator.ValidationRules.Messages),
    Categories: Object.keys(Validator.ValidationRules.Categories),
  };

  // Segregate the valid input into specific database object using validation rules
  private static segregate = (
    value: ValidInput,
    rules: (keyof typeof Validator.ValidationRules)[]
  ): ValidInput[] => {
    let arr: any[] = [];
    for (let key in value) {
      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
        const rule = rules[ruleIndex];
        if (!arr[ruleIndex]) arr[ruleIndex] = {};
        if (Validator.Keys[rule].includes(key))
          arr[ruleIndex][key] = (value as any)[key];
      }
    }
    return arr;
  };

  static readonly validate = {
    userProfile: (data: any) =>
      Validator.Schema.UserProfile.validate(data, Validator.options),
    category: (data: any) =>
      Validator.Schema.Category.validate(data, Validator.options),
    conversation: (data: any) =>
      Validator.Schema.Conversation.validate(data, Validator.options),
    message: (data: any) =>
      Validator.Schema.Message.validate(data, Validator.options),
  };

  // A simple wrapper function around validate for additional operations like segregation of data.
  static readonly useValidator = (
    useValidationFunction: keyof typeof Validator.validate,
    rules: (keyof typeof Validator.ValidationRules)[] = []
  ) => {
    const funct = Validator.validate[useValidationFunction];

    // Set the rules used for segregation
    if (rules.length === 0) {
      switch (useValidationFunction) {
        case "userProfile": {
          rules = ["Profiles", "Users"];
          break;
        }
        case "category": {
          rules = ["Categories"];
          break;
        }
        case "conversation": {
          rules = ["Conversations", "Chats"];
          break;
        }
        case "message": {
          rules = ["Messages"];
          break;
        }
      }
    }

    // Return a higher order function (a wrapper around the validate function)
    return (data: any) => {
      const { error, value } = funct(data);
      if (error) throw error;
      return Validator.segregate(value, rules);
    };
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
