# Cocos build for Atom

Runs [cocos][] commands in the `Atom` editor.

This package requires [atom-build][] to be installed.

## Features

### Add Build Targets for Cocos2d-x Projects

Supports run `cocos compile`, `cocos deploy` and `cocos run` commands inside `Atom`.


![Targets](https://raw.githubusercontent.com/xpol/build-cocos/master/images/targets.png)

### Captures Build and Run Errors

* Captures build errors and Lua script runtime errors.
* Provides error link to source code.

Cpp build errors:

![Cpp Errors](https://raw.githubusercontent.com/xpol/build-cocos/master/images/cpp-errors.png)

Lua runtime errors:

![Lua Errors](https://raw.githubusercontent.com/xpol/build-cocos/master/images/lua-errors.png)

## Setup

1. Install [atom-build][] and this [build-cocos][] package.
2. To setup cocos path you have two options either:
  * In Atom -> Preferences... -> Packages -> build-cocos -> Settings -> Set the `Global cocos console path`. eg: `/Users/xpol/Workspace/cocos2d-x/tools/cocos2d-console`.
  * Have a project local copy of cocos-console in you project in `framewroks/cocos2d-x/tools/cocos2d-console`.
3. For Lua project
  * You need the `cocos-console` with this [pending pull request (please help up vote)](https://github.com/cocos2d/cocos2d-console/pull/320) to captures the runtime errors.
  * Set Lua package path to have `src/?.lua;` rather than add `src/` to FileUtils' search path, see example `main.lua`.
  * Make a `xpcall` to your main function and call `os.exit(1)` in error handler. see example `main.lua`.
4. After that, in Atom open you project root directory which contains `.cocos-project.json`, run `cmd-alt-t` / `ctrl-alt-t` / `f7` to displays the available build targets.

## Example


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

Ideas, bugs and pull requests please go to GitHub [xpol/build-cocos][repo].

[atom-build]: https://atom.io/packages/build
[build-cocos]: https://atom.io/packages/build-cocos
[cocos]: https://github.com/cocos2d/cocos2d-console
[repo]: https://github.com/xpol/build-cocos
