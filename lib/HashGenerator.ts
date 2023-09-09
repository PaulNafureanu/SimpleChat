import bcrypt from "bcrypt";

class HashGenerator {
  private static saltRounds = 12;
  private constructor() {}

  static readonly hash = async (data: string) => {
    try {
      const hashResult = await bcrypt.hash(data, HashGenerator.saltRounds);
      return hashResult;
    } catch (err) {
      throw err;
    }
  };

  static readonly compare = async (data: string, hashResult: string) => {
    try {
      const match = await bcrypt.compare(data, hashResult);
      return match;
    } catch (err) {
      throw err;
    }
  };
}

export default HashGenerator;
