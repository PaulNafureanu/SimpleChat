import bcrypt from "bcrypt";

class HashGenerator {
  private static saltRounds = 10;
  private constructor() {}

  static hash = async (data: string) => {
    try {
      const hashResult = await bcrypt.hash(data, HashGenerator.saltRounds);
      return hashResult;
    } catch (err) {
      throw err;
    }
  };

  static compare = async (data: string, hashResult: string) => {
    try {
      const match = await bcrypt.compare(data, hashResult);
      return match;
    } catch (err) {
      throw err;
    }
  };
}

export default HashGenerator;
