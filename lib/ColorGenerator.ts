class ColorGenerator {
  static getRandomColor = (limit: number = 256) => {
    if (limit > 256) limit = 256;
    if (limit < 0) limit = 0;

    const randomR = Math.round(Math.random() * limit);
    const randomG = Math.round(Math.random() * limit);
    const randomB = Math.round(Math.random() * limit);

    const hexR = randomR.toString(16).padStart(2, "0");
    const hexG = randomG.toString(16).padStart(2, "0");
    const hexB = randomB.toString(16).padStart(2, "0");

    return `#${hexR}${hexG}${hexB}`;
  };

  static getColorByPrompt = (
    prompt: string,
    limits: {
      Rlimit?: number;
      Glimit?: number;
      Blimit?: number;
      limit?: number;
    } = {
      Rlimit: 256,
      Glimit: 256,
      Blimit: 256,
      limit: 256,
    }
  ) => {
    let { Rlimit, Glimit, Blimit, limit = 256 } = limits;
    if (!Rlimit) Rlimit = limit;
    if (!Glimit) Glimit = limit;
    if (!Blimit) Blimit = limit;

    if (Rlimit > 256) Rlimit = 256;
    if (Rlimit < 0) Rlimit = 0;
    if (Glimit > 256) Glimit = 256;
    if (Glimit < 0) Glimit = 0;
    if (Blimit > 256) Blimit = 256;
    if (Blimit < 0) Blimit = 0;

    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      hash = prompt.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `rgb(${(hash & 0xff) % Rlimit}, ${
      ((hash >> 8) & 0xff) % Glimit
    }, ${((hash >> 16) & 0xff) % Blimit})`;

    return color;
  };
}

export default ColorGenerator;
