'use babel';

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const isWindows = /^win/.test(process.platform);

const cppConfig = {
  errorRegexs: [
    // In cpp projects all source code is in `Classes` directory
    '(?<file>Classes/[^:\\n]+):(?<line>\\d+): (error|warning):',
    '(?<file>Classes/[^:\\n]+):(?<line>\\d+):(?<col>\\d+): (error|warning|note):',
    '(?<file>Classes/[^:\\n]+):(?<line>\\d+): (error|warning):',
    '(?<file>Classes/[^:\\n]+\\.(java|cpp|c|m|mm|h|hpp)):(?<line>\\d+):(?<col>\\d+):' // this is for xcpretty filtered errors.
  ],
  simulators: { // not supported simulators for cpp projects.
    darwin: 'bin/debug/mac/PROJECT-desktop.app/Contents/MacOS/PROJECT-desktop',
    linux: 'bin/debug/linux/PROJECT',
    win32: 'bin\\debug\\win32\\PROJECT.exe'
  }
};


const scriptConfig = {
  errorRegexs: [ // for lua and js
    // C/C++/Java build error regexs:
    '(?<file>frameworks/[^:\\n]+):(?<line>\\d+): (error|warning):',
    '(?<file>frameworks/[^:\\n]+):(?<line>\\d+):(?<col>\\d+): (error|warning|note):',
    '(?<file>frameworks/[^:\\n]+):(?<line>\\d+): (error|warning):',
    '(?<file>frameworks/[^:\\n]+\\.(java|cpp|c|m|mm|h|hpp)):(?<line>\\d+):(?<col>\\d+):', // this is for xcpretty filtered errors.

    // Lua runtime error regexs:
    '(?<file>src[^\\n:]+\\.lua):(?<line>\\d+):',
    '\\[string \\"(?<file>[^\\"]+)\\"\\] at line (?<line>\\d+)',
    '\\[string \\"(?<file>[^\\"]+)\\"\\]:(?<line>\\d+)',
    'at file \'(?<file>[^:]+):(?<line>\\d+)\'',
    'line (?<line>\\d+) of chunk \'\\"(?<file>[^"]+)\\"',
    'load \\"(?<file>[^\\\"]+)\\"'

    // TODO: add Javascript runtime error regexs.
  ],
  simulators: {
    darwin: 'simulator/mac/PROJECT-desktop.app/Contents/MacOS/PROJECT-desktop',
    linux: 'simulator/linux/PROJECT',
    win32: 'simulator\\win32\\PROJECT.exe'
  }
};

const LANGS = {
  cpp: cppConfig,
  js: scriptConfig,
  lua: scriptConfig
};


const platforms = {
  darwin: {
    android: ['compile', 'deploy', 'run', 'release'],
    ios: ['compile', 'release'],
    mac: ['compile', 'run'],
    web: ['compile', 'run']
  },
  linux: {
    android: ['compile', 'deploy', 'run', 'release'],
    linux: ['compile', 'run'],
    web: ['compile', 'run']
  },
  win32: {
    android: ['compile', 'deploy', 'run', 'release'],
    win32: ['compile', 'run'],
    web: ['compile', 'run']
  }
};

const displayNames = {
  android: 'Android',
  ios: 'iOS',
  mac: 'Mac',
  win32: 'Win32',
  web: 'Web',
  linux: 'Linux',
  darwin: 'Mac',
  compile: 'Build',
  deploy: 'Deploy',
  run: 'Run'
};


const getSimulator = (projectName, lang) => {
  const template = LANGS[lang].simulators[process.platform];
  return template.replace(/PROJECT/g, projectName);
};

const addSimulatorTask = (builder, tasks, errorMatch) => {
  const simulator = builder.simulator;
  if (!simulator) {
    return tasks;
  }

  // When running in shall mode, quoted path is auto trimmed before passed to simulator.
  // Windows simulator is not runing in shell mode, so we don't needs quote the path.
  const workdir = isWindows ? '{PROJECT_PATH}' : '"{PROJECT_PATH}"';
  let args = ['-console', 'NO', '-workdir', workdir];
  if (builder.lang === 'lua') {
    args = args.concat(['-entry', 'src/main.lua']);
  }

  tasks.push({
    name: `${displayNames[process.platform]}: Run simulator without build`,
    exec: simulator,
    args: args,
    sh: !isWindows,
    errorMatch: errorMatch,
    active: true
  });
  return tasks;
};

const addReleaseTask = (builder, tasks, exec, plat, errorMatch) => {
  const args = ['compile', '-p', plat, '-m', 'release'];
  if (builder.lang === 'lua' && builder.luaEncrypt) {
    args.push(
      '--lua-encrypt',
      '--lua-encrypt-key', builder.luaEncryptKey,
      '--lua-encrypt-sign', builder.luaEncryptSign
    );
  }
  if (plat === 'ios' && builder.iosCodeSignIdentity.length > 0) {
    args.push('--sign-identity', builder.iosCodeSignIdentity);
  } else if (plat === 'android' && builder.androidStudio) {
    args.push('--android-studio');
  }
  tasks.push({
    name: `${displayNames[plat]} : Release`,
    exec,
    args,
    errorMatch,
    sh: false
  });
  return tasks;
};

const addCocosTask = (builder, tasks, exec, cmd, plat, errorMatch) => {
  if (cmd === 'release') {
    return addReleaseTask(builder, tasks, exec, plat, errorMatch);
  }
  let args = [cmd, '-p', plat];
  if (cmd === 'run') {
    args = args.concat(['--no-console', '--working-dir', '"{PROJECT_PATH}"']);
  }
  tasks.push({
    name: `${displayNames[plat]} : ${displayNames[cmd]}`,
    exec,
    args,
    errorMatch,
    sh: false
  });
  return tasks;
};

const getCocosExecutable = (cwd) => {
  const executable = isWindows ? 'cocos.bat' : 'cocos';
  const localPath = path.join(cwd, 'frameworks', 'cocos2d-x', 'tools', 'cocos2d-console', 'bin', executable);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const consoleRoot = atom.config.get('build-cocos.consoleRoot');
  const globalPath = path.join(consoleRoot, 'bin', executable);
  if (fs.existsSync(globalPath)) {
    return globalPath;
  }
  return executable;
};

const getConfig = (local, key) => {
  return local[key] !== undefined ? local[key] : atom.config.get(`build-cocos.${key}`);
};

export const config = {
  consoleRoot: {
    title: 'Global cocos console path',
    description: 'Absolute path to the global `cocos-console` directory. **Needs restart Atom** after setting or changing this. eg `/Users/xpol/Workspace/cocos2d-x/tools/cocos2d-console`',
    type: 'string',
    default: '',
    order: 1
  },
  androidStudio: {
    title: 'Andriod Studio',
    description: 'Build Android Studio project in `proj.android-studio` rather than `proj.android`. Can overwrite in `.cocos-project.json` with root key `androidStudio`.',
    type: 'boolean',
    default: false,
    order: 6
  },
  iosCodeSignIdentity: {
    title: 'iOS Code Sign Identity',
    description: 'iOS code sign identity used to run `iOS: Release` target, eg. `iPhone Distribution: xxx... (XXXXXXXXXX)`. Can overwrite in `.cocos-project.json` with root key `iosCodeSignIdentity`.',
    type: 'string',
    default: '',
    order: 7
  },
  luaEncrypt: {
    title: 'Encrypt Lua Script',
    description: 'Enable encryption of Lua scripts when run `Release` targets. Can overwrite in `.cocos-project.json` with root key `luaEncrypt`.',
    type: 'boolean',
    default: true,
    order: 9
  },
  luaEncryptKey: {
    title: 'Global Lua Encryption Key',
    description: 'Key used to encrypt Lua scripts when run `Release` targets. Can overwrite in `.cocos-project.json` with root key `luaEncryptKey`.',
    type: 'string',
    default: '2dxLua',
    order: 10
  },
  luaEncryptSign: {
    title: 'Global Lua Encrypted File Sign',
    description: 'File signature for encrypted Lua script files when run `Release` targets. Can overwrite in `.cocos-project.json` with root key `luaEncryptSign`.',
    type: 'string',
    default: 'XXTEA',
    order: 11
  }
};

const removeFileWatchers = (builder) => {
  (builder.fileWatchers || []).forEach(fw => fw.close());
  builder.fileWatchers = [];
};

export function provideBuilder() {
  return class MakeBuildProvider extends EventEmitter {
    constructor(cwd) {
      super();
      this.cwd = cwd;
      this.cocosfile = path.join(this.cwd, '.cocos-project.json');
      // refresh on settings did change
      this.configWatcher = atom.config.onDidChange('build-cocos', () => this.emit('refresh'));
    }

    destructor() {
      this.configWatcher.dispose();
      removeFileWatchers(this);
    }

    getNiceName() {
      return 'Cocos';
    }

    isEligible() {
      // remove last wathers.
      removeFileWatchers(this);

      if (!fs.existsSync(this.cocosfile)) {
        return false;
      }

      const ccconf = JSON.parse(fs.readFileSync(this.cocosfile, 'utf8'));
      for (const key of Object.keys(config)) {
        this[key] = getConfig(ccconf, key);
      }
      this.lang = ccconf.project_type;
      // Watch files changes
      this.fileWatchers.push(fs.watch(this.cocosfile, () => this.emit('refresh')));

      if (this.lang !== 'cpp') {
        const islua = this.lang === 'lua';
        const simconf = islua ? 'config.json' : 'manifest.webapp';
        const simconffull = path.join(this.cwd, simconf);
        if (!fs.existsSync(simconffull)) {
          atom.notifications.addWarning('You simulator config file is missing.', {
            dismissable: true,
            detail: `You ${this.lang} project at ${this.cwd} should have simulator config file '${simconf}'.`
          });
        } else {
          this.fileWatchers.push(fs.watch(simconffull, () => this.emit('refresh')));
          const json = JSON.parse(fs.readFileSync(simconffull, 'utf8'));
          this.simulator = getSimulator(islua ? json.init_cfg.name : json.name, this.lang);
        }
      }

      return true;
    }

    settings() {
      const exec = getCocosExecutable(this.cwd);
      const supports = platforms[process.platform];
      const regexs = LANGS[this.lang].errorRegexs;

      // Configure build targets
      let tasks = [];
      if (this.lang !== 'cpp') {
        addSimulatorTask(this, tasks, regexs);
      }
      for (const platform in supports) {
        if (platform === 'web' && this.lang !== 'js') {
          continue;
        }
        for (const cmd of supports[platform]) {
          tasks = addCocosTask(this, tasks, exec, cmd, platform, regexs);
        }
      }
      tasks.sort((a, b)=> a.name.localeCompare(b.name));
      return tasks;
    }
  };
}
