"use babel";

import fs from "fs";
import path from "path";

const cppConfig = {
  errorRegexs: [
    // In cpp projects all source code is in `Classes` directory
    "(?<file>Classes/[^:\\n]+):(?<line>\\d+): (error|warning):",
    "(?<file>Classes/[^:\\n]+):(?<line>\\d+):(?<col>\\d+): (error|warning|note):",
    "(?<file>Classes/[^:\\n]+):(?<line>\\d+): (error|warning):",
    "(?<file>Classes/[^:\\n]+\\.(java|cpp|c|m|mm|h|hpp)):(?<line>\\d+):(?<col>\\d+):" // this is for xcpretty filtered errors.
  ],
  projectNameFinder: {file: "proj.ios_mac/mac/Info.plist", regex: /<string>.+\.([^\.]+)<\/string>/},
  simulators: {
    darwin: "bin/debug/mac/PROJECT-desktop.app/Contents/MacOS/PROJECT-desktop",
    linux: "bin/debug/linux/PROJECT",
    win32: "bin\\debug\\win32\\PROJECT.exe"
  }
};


const scriptConfig = {
  errorRegexs: [ // for lua and js
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
  ],
  projectNameFinder: {file: ".project", regex: /<name>(.+)<\/name>/},
  simulators: {
    darwin: "simulator/mac/PROJECT-desktop.app/Contents/MacOS/PROJECT-desktop",
    linux: "simulator/linux/PROJECT",
    win32: "simulator\\win32\\PROJECT.exe"
  }
};

const LANGS = {
  cpp: cppConfig,
  js: scriptConfig,
  lua: scriptConfig
};

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
  linux: "Linux",
  darwin: "Mac",
  compile: "Compile",
  deploy: "Deploy",
  run: "Run"
};

const getSimulator = (root, lang) => {
  const pair = LANGS[lang].projectNameFinder;
  const file = path.join(root, pair.file);
  if (!fs.existsSync(file)) {
    return null;
  }

  const txt = fs.readFileSync(file, "utf8");
  console.log(txt);
  const match = pair.regex.exec(txt);
  if (!match || !match[1]) {
    return null;
  }
  const template = LANGS[lang].simulators[process.platform];
  const simulator = template.replace(/PROJECT/g, match[1]);
  console.log(simulator);
  return simulator;
};

const addSimulatorTask = (config, simulator, errorMatch) => {
  if (!simulator) {
    return config;
  }
  config.push({
    name: displayNames[process.platform] + ": Run without build",
    exec: simulator,
    args: ["-console", "NO", "-workdir", "\"{PROJECT_PATH}\""],
    errorMatch: errorMatch
  });
  return config;
};

const addCocosTask = (config, exec, cmd, plat, errorMatch) => {
  let args = [cmd, "--platform", plat];
  if (cmd === "run") {
    args = args.concat(["--no-console", "--working-dir", "\"{PROJECT_PATH}\""]);
  }
  config.push({
    name: displayNames[plat] + ": " + displayNames[cmd],
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
      const ccconf = JSON.parse(fs.readFileSync(cocosfile, "utf8"));
      this.lang = ccconf.project_type;
      this.simulator = getSimulator(this.cwd, this.lang);
      return true;
    }

    settings() {
      const exec = getExecutable(this.cwd);
      const supports = platforms[process.platform];
      const regexs = LANGS[this.lang].errorRegexs;
      let tasks = [];
      addSimulatorTask(tasks, this.simulator, regexs);
      for (const platform in supports) {
        if (platform === "web" && this.lang !== "js") {
          continue;
        }
        for (const cmd of supports[platform]) {
          tasks = addCocosTask(tasks, exec, cmd, platform, regexs);
        }
      }
      tasks.sort((a, b)=>{return a.name.localeCompare(b.name);})
      return tasks;
    }
  };
}
