"use babel";

import fs from "fs";
import path from "path";


const regexs = [
  // C/C++/Java build error regexs:
  "(?<file>frameworks/[^:\\n]+):(?<line>\\d+): (error|warning):",
  "(?<file>frameworks/[^:\\n]+):(?<line>\\d+):(?<col>\\d+): (error|warning|note):",
  "(?<file>frameworks/[^:\\n]+):(?<line>\\d+): (error|warning):",
  "(?<file>frameworks/[^:\\n]+\\.(java|cpp|c|m|mm|h|hpp)):(?<line>\\d+):(?<col>\\d+):", // this is for xcpretty filtered errors.

  // Lua runtime error regexs:
  "(?<file>src[^\\n:]+\\.lua):(?<line>\\d+):",
  "\\[string \\\"(?<file>[^\\\"]+)\\\"\\] at line (?<line>\\d+)",
  "\\[string \\\"(?<file>[^\\\"]+)\\\"\\]:(?<line>\\d+)",
  "at file '(?<file>[^:]+):(?<line>\\d+)'",
  "line (?<line>\\d+) of chunk '\\\"(?<file>[^\\\"]+)\\\"",
  "load \\\"(?<file>[^\\\"]+)\\\""

  // TODO: add Javascript runtime error regexs.
];

const platforms = {
  darwin: {
    android: ["compile", "deploy", "run"],
    ios: ["compile"],
    mac: ["compile", "run"],
    web: ["compile", "run"]
  },
  linux: {
    android: ["compile", "deploy", "run"],
    linux: ["compile", "run"],
    web: ["compile", "run"]
  },
  win32: {
    android: ["compile", "deploy", "run"],
    win32: ["compile", "run"],
    web: ["compile", "run"]
  }
};

const displayNames = {
  android: "Android",
  ios: "iOS",
  mac: "Mac",
  win32: "Win32",
  web: "Web",
  compile: "Compile for ",
  deploy: "Deploy to ",
  run: "Run on "
};

const addTask = (config, exec, cmd, plat, errorMatch) => {
  const args = [cmd, "--platform", plat];
  if (cmd === "run") {
    args.push("--no-console");
  }
  config.push({
    name: displayNames[cmd] + displayNames[plat],
    exec: exec,
    args: args,
    errorMatch: errorMatch
  });
  return config;
};

const getExecutable = (cwd) => {
  const executable = /^win/.test(process.platform) ? "cocos.bat" : "cocos";
  const localPath = path.join(cwd, "frameworks", "cocos2d-x", "tools", "cocos2d-console", "bin", executable);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const consoleRoot = atom.config.get("build-cocos.consoleRoot");
  const globalPath = path.join(consoleRoot, "bin", executable);
  if (fs.existsSync(globalPath)) {
    return globalPath;
  }
  return executable;
};


export const config = {
  consoleRoot: {
    title: "Global cocos console path",
    description: "Absolute path to the global `cocos-console` directory. **Needs restart Atom** after setting or changing this. eg `/Users/xpol/Workspace/cocos2d-x/tools/cocos2d-console`",
    type: "string",
    default: "",
    order: 1
  }
};

export function provideBuilder() {
  return class MakeBuildProvider {
    constructor(cwd) {
      this.cwd = cwd;
    }

    getNiceName() {
      return "Cocos";
    }

    isEligible() {
      const cocosfile = path.join(this.cwd, ".cocos-project.json");
      if (!fs.existsSync(cocosfile)) {
        return false;
      }
      this.ccconf = JSON.parse(require("fs").readFileSync(cocosfile, "utf8"));
      return true;
    }

    settings() {
      const exec = getExecutable(this.cwd);
      const supports = platforms[process.platform];
      let tasks = [];
      for (const platform in supports) {
        if (platform === "web" && this.ccconf.project_type !== "js") {
          continue;
        }
        const pconf = supports[platform];
        for (let i = 0; i < pconf.length; i++) {
          const cmd = pconf[i];
          tasks = addTask(tasks, exec, cmd, platform, regexs);
        }
      }
      return tasks;
    }
  };
}
