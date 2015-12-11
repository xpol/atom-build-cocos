"use babel";

import fs from "fs";
import path from "path";

const isWindows = /^win/.test(process.platform);

const cppConfig = {
  errorRegexs: [
    // In cpp projects all source code is in `Classes` directory
    "(?<file>Classes/[^:\\n]+):(?<line>\\d+): (error|warning):",
    "(?<file>Classes/[^:\\n]+):(?<line>\\d+):(?<col>\\d+): (error|warning|note):",
    "(?<file>Classes/[^:\\n]+):(?<line>\\d+): (error|warning):",
    "(?<file>Classes/[^:\\n]+\\.(java|cpp|c|m|mm|h|hpp)):(?<line>\\d+):(?<col>\\d+):" // this is for xcpretty filtered errors.
  ],
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

const nameFinders = [
  {file: ".project", regex: /<name>(.+)<\/name>/},
  {file: "config.json", regex: /"name": "(.+)"/},
  {file: "proj.ios_mac/mac/Info.plist", regex: /<string>.+\.([^\.]+)<\/string>/},
  {file: "frameworks/runtime-src/proj.ios_mac/mac/Info.plist", regex: /<string>.+\.([^\.]+)<\/string>/}
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
  linux: "Linux",
  darwin: "Mac",
  compile: "Build",
  deploy: "Deploy",
  run: "Run"
};


const findProjectName = (root) => {
  // find project in finders
  for (const finder of nameFinders) {
    const file = path.join(root, finder.file);
    if (!fs.existsSync(file)) {
      continue;
    }

    const txt = fs.readFileSync(file, "utf8");
    const match = finder.regex.exec(txt);
    if (!match || !match[1]) {
      continue;
    }
    return match[1];
  }

  // Default to root directory name.
  return path.basename(root);
};

const getSimulator = (root, lang) => {
  const name = findProjectName(root);
  const template = LANGS[lang].simulators[process.platform];
  const simulator = template.replace(/PROJECT/g, name);
  return simulator;
};

const addSimulatorTask = (config, simulator, errorMatch, lang) => {
  if (!simulator) {
    return config;
  }

  // When running in shall mode, quoted path is auto trimmed before passed to simulator.
  // Windows simulator is not runing in shell mode, so we don't needs quote the path.
  const workdir = isWindows ? "{PROJECT_PATH}" : "\"{PROJECT_PATH}\"";
  let args = ["-console", "NO", "-workdir", workdir];
  if (lang === "lua") {
    args = args.concat(["-entry", "src/main.lua"]);
  }

  config.push({
    name: displayNames[process.platform] + ": Run without build",
    exec: simulator,
    args: args,
    sh: !isWindows,
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
    sh: false,
    errorMatch: errorMatch
  });
  return config;
};

const getExecutable = (cwd) => {
  const executable = isWindows ? "cocos.bat" : "cocos";
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
      addSimulatorTask(tasks, this.simulator, regexs, this.lang);
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
