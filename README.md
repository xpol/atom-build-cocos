# Cocos build for Atom

Runs cocos2d-x tasks like **build**, **deploy**, **run**, and **release** in the `Atom` editor.
And captures build and runtime errors.

This package requires [atom-build][] and [cocos-console][cocos] to be installed.


## How It Works

A project are consider as a cocos2d-x project if there is a `.cocos-project.json`
at project root. And it takes `project_type` key in this file for the project
type (**cpp**|**lua**|**js**).

For `Run simulator without build` tasks, it find simulator executable name in:

* `init_cfg.name` in `config.json` for **lua** projects
* `name` in `manifest.webapp` for **js** projects.

and runs debug build executables create by `cocos compile -p mac|win32` as simulator.

Do make sure the above config are correct for your project and
`cocos compile -p mac|win32` commands works well.

## Features

### Add Build Targets for Cocos2d-x Projects

Supports run **build**, **deploy**, **run**, and **release** tasks inside `Atom`.

Build targets for a Lua project:

![Targets](https://raw.githubusercontent.com/xpol/build-cocos/master/images/targets.png)

### Captures Build and Runtime Errors

* Captures build errors and Lua script runtime errors.
* Provides error link to source code.

Cpp build errors:

![Cpp Errors](https://raw.githubusercontent.com/xpol/build-cocos/master/images/cpp-errors.png)

Lua runtime errors:

![Lua Errors](https://raw.githubusercontent.com/xpol/build-cocos/master/images/lua-errors.png)

### Support Additional Configure in .cocos-project.json

Additional key for `.cocos-project.json`:

* `androidABI`: Set `APP_ABI` for Android build, multiple abi can be set like `armeabi-v7a:x86`. Default `armeabi`.
* `androidStudio`: Set `true` to build Android Studio project in `proj.android-studio` rather than `proj.android`. Default `false`.
* `iosCodeSignIdentity`: iOS code sign identity used to run `iOS: Release` target. eg. `iPhone Distribution: xxx... (XXXXXXXXXX)`.
* `luaEncrypt`: Set `false` to disable encryption of Lua scripts when run `Release` targets. Default `true`.
* `luaEncryptKey`: The key used to encrypt Lua scripts when run `Release` targets. Default `2dxLua`.
* `luaEncryptSign`: File signature for encrypted Lua script files when run `Release` targets. Default `XXTEA`


## Setup

1. Install [atom-build][] and this [atom-build-cocos][] package `apm install build build-cocos`.
2. To setup cocos path you have two options either:
  * In Atom -> Preferences... -> Packages -> build-cocos -> Settings -> Set the `Global cocos console path`. eg: `/Users/xpol/Workspace/cocos2d-x/tools/cocos2d-console`.
  * Have a project local copy of cocos-console in you project in `framewroks/cocos2d-x/tools/cocos2d-console`.
3. For Lua project
  * You need [master branch of my fork of `cocos-console`][cocos-fork] (up vote this [pending pull request](https://github.com/cocos2d/cocos2d-console/pull/320) to make it official) to run simulator and captures the runtime Lua errors.
  * Set Lua package path to have `src/?.lua;` rather than add `src/` to FileUtils' search path, see example `main.lua`.
  * Make a `xpcall` to your main function and call `os.exit(1)` in error handler. see example `main.lua`.
4. After that, in Atom open you project root directory which contains `.cocos-project.json`, run `cmd-alt-t` / `ctrl-alt-t` / `f7` to displays the available build targets.
5. Set `.cocos-project.json`:
  * Set `iosCodeSignIdentity` if you needs build iOS release ipa.
  * For **lua** projects, set `luaEncrypt` `luaEncryptKey` and `luaEncryptSign` to enable encryption for Lua scripts.
  * Android projects, set `androidStudio` if you want build in project in `proj.android-studio`.

**Examples**


`src/main.lua`

```lua
package.path = 'src/?.lua;src/packages/?.lua'
local fu = cc.FileUtils:getInstance()
fu:setPopupNotify(false)
fu:addSearchPath("res/") -- only add 'res/' for cocos search path, do not add 'src/'.


local function main()
	-- your code here...
end


local traceback = __G__TRACKBACK__

function __G__TRACKBACK__(msg)
  traceback(msg)
  os.exit(1) -- exit on error so that the error will be parsed by atom-build.
end

xpcall(main, __G__TRACKBACK__)

```

## Contribute

Ideas, bugs and pull requests please go to GitHub [xpol/atom-build-cocos][repo].

[atom-build]: https://atom.io/packages/build
[atom-build-cocos]: https://atom.io/packages/build-cocos
[cocos]: https://github.com/cocos2d/cocos2d-console
[cocos-fork]: https://github.com/xpol/cocos2d-console
[repo]: https://github.com/xpol/atom-build-cocos
