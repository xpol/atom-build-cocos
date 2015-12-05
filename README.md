# Cocos build for Atom

Runs [cocos][] commands in the `Atom` editor.

Supports `compile`, `deploy` and `run` inside `Atom`.
Captures build errors and Lua script runtime errors, provides error link to source code.

This package requires [atom-build][] to be installed.

[cocos]: https://github.com/cocos2d/cocos2d-console
[atom-build]: https://github.com/noseglid/atom-build

## Setup

1. You need the `cocos-console` form this [pending pull request](https://github.com/cocos2d/cocos2d-console/pull/320).
2. To setup cocos path you have two options either:
	* add `console_root` in `.cocos-project.json` prints to your global `cocos-console` root, eg: `"console_root": "/Users/xpol/Workspace/cocos2d-x/tools/cocos2d-console"`.
	* have a local copy of cocos-console in you project `framewroks/cocos2d-x/tools/cocos2d-console`.
3. For lua project
	* set package path to have `src/?.lua;` rather than add it to FileUtils' search path, see example main.lua.
	* make a xpcall to your main function and call `os.exit(1)` in error handler. see example main.lua
4. After that, in Atom open you project root directory which contains `.cocos-project.json`, run `cmd-alt-t` / `ctrl-alt-t` / `f7` to displays the available build targets.

## Example

`.cocos-project.json`

```json
{
    "engine_version": "cocos2d-x-3.9",
    "has_native": true,
    "project_type": "lua",
    "console_root": "/Users/xpol/Workspace/cocos2d-x/tools/cocos2d-console"
}

```


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
  if devconf.EXIT_ON_ERROR then os.exit(1) end -- This is useful when works with atom-build.
end

xpcall(main, __G__TRACKBACK__)

```