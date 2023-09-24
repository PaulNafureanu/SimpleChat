import { NextResponse } from "next/server";
import Validator from "@/db2/Validator";
import UserProfile from "@/db2/UserProfile";
import fs from "node:fs";
import path from "node:path";

interface DirectDBSearchQuery {
  script?: (typeof DirectDB.allowed)[number];
  filename?: string;
}

/**
 * TODO: Warning: Deactivate or delete the '/api/db' endpoint for production!
 * A simple class for inserting dummy data from a json file into the xata database.
 * Called using GET method api on the '/api/db' endpoint and passing a query string script.
 * Only in development!
 */
class DirectDB {
  private static demoProfileID = "rec_cjutmrqcpifs90st609g";
  static allowed = ["help", "profiles"] as const;

  // Add in template if you modify the interface
  static readonly QueryTemplate: DirectDBSearchQuery = {
    script: "help",
    filename: "",
  };

  // The main script that will run at the endpoint
  static readonly run = async ({
    script = "help",
    filename,
  }: DirectDBSearchQuery) => {
    try {
      // Run only the allowed methods with valid params
      if (!DirectDB.allowed.includes(script) || script === "help")
        return DirectDB.responses("notAllowed");
      if (!filename) return DirectDB.responses("notFound");

      return await DirectDB[script](filename);
    } catch (error) {
      return DirectDB.responses("errorDB");
    }
  };

  // Specific scripts that insert data into xata db
  private static profiles = async (filename: string) => {
    const dataToUploadDB = await DirectDB.getDataFromFile(filename);
    for (const data of dataToUploadDB) {
      const { error, value } = Validator.validate.userProfile(data);
      if (error) continue;
      await UserProfile.create(value);
    }

    return NextResponse.json("Profiles created, check xata db.");
  };

  private static getDataFromFile = async (filename: string) => {
    try {
      filename = filename.includes(".json") ? filename : filename + ".json";
      const filePath = path.join(process.cwd(), "data", "dummy", filename);
      const rawData = fs.readFileSync(filePath, "utf-8");
      let data = JSON.parse(rawData);
      if (!Array.isArray(data)) data = [data];
      return data as any[];
    } catch (error) {
      throw new DirectDB.Error("Could not read the json file.");
    }
  };

  // Some default responses for common cases
  private static responses = (type: "notAllowed" | "notFound" | "errorDB") => {
    switch (type) {
      case "notAllowed":
        return NextResponse.json(
          {
            Note: "Filename and script string queries both required.",
            "Allowed values for the script string query are": DirectDB.allowed,
          },
          { status: 400 }
        );
      case "notFound":
        return NextResponse.json(
          "Filename and script string queries both required.",
          { status: 400 }
        );
      case "errorDB":
        return NextResponse.json("Error with xata db.", {
          status: 500,
        });
      default:
        return NextResponse.json("DirectDB unexpected error", { status: 500 });
    }
  };

  static Error = class DirectDBError extends Error {};
}

export default DirectDB;
