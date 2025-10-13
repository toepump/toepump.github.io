+++
title = "My Godot and Neovim Setup"
description = "How I setup Godot Engine to work seamlessly with Neovim as an external editor."
date = 2025-10-10
[taxonomies]
tags = ["godot", "neovim", "fish", "ghostty", "linux"]
+++

## Environment

| Component Type    | Component Value                                 | Notes                                                                                                                      |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Linux Distro      | [Endeavor OS (GNOME)](https://endeavouros.com/) | All of the linux packages mentioned in this document are native `pacman` packages (official maintained ones, not from AUR) |
| Terminal Emulator | [Ghostty](https://ghostty.org/)                 |                                                                                                                            |
| Shell             | [Fish](https://fishshell.com/)                  |                                                                                                                            |

This article assumes an `nvim` setup based on Kickstart.Nvim.
## Goals

1. Open scripts that are clicked from Godot Engine in neovim
2. Support LSP features for autocomplete, go-to references, etc.
3. Godot Engine documentation references in neovim
4. Formatting
5. Linting

tldr;

Do mostly what Simon Dalvai did here: [Neovim As External Editor for Godot](https://simondalvai.org/blog/godot-neovim/)
But if you run into any issues (particularly if you're based on Kickstart.Nvim), then come back here take a look at my notes!

I was unable to get it working without some further investigation.

---
## Problem 1: mason-lspconfig

Kickstart sets you up with `mason-lspconfig` and encourages you to use it for setting up Language Server Protocols if possible.

**I wasn't able to get the Godot lsp working via `mason-lspconfig`.**

Why? Because `mason-lspconfig` does not have a pre-configuration mapping for `gdscript` language server.

`mason-lspconfig` is basically just a convenience which bridges the gap between `mason` and `nvim-lspconfig`. Their purposes are respectively:
1. `mason` - managing packages for lsp by downloading them and installing them
2. `nvim-lspconfig` - configuring and _enabling_ these lsps for nvim to use 

`mason-lspconfig` just makes it easier to do all of the above in one step for _supported language servers_ (install, enable, configure). However, `gdscript` is _not_ one of the supported languages.

> Now, Kickstart is a little misleading here as the `mason-config` setup lines have comments saying that you can do `:help lspconfig-all` to see all the pre-configured languages. If you do so, then `gdscript` actually does show up. 
> 
 However, this list is only describing the available `nvim-lspconfig` language servers. It has nothing to do with `mason-lspconfig` which, again, doesn't have a mapping from `mason` to `nvim-lspconfig`'s managed `gdscript` language server. 

If you do attempt to set up `gdscript` via `mason-lspconfig`, then you'll get an error saying that the `gdscript` package was not found.

**Here is the key insight. Godot itself holds a language server and is expected to be running while you write gdscript code.**

So, actually it sort of makes sense that the `mason-lspconfig` guys didn't bother with implementing a bridge to `nvim-lspconfig` for a language server that most people won't even install with `mason`. (See below Note: "But I didn't install gdscript with mason yet?")

In other words, why create a convenient auto setup from `mason` to `nvim-lspconfig` for a language that nobody will, or should, install via `mason` in the first place. Just let Godot be the LSP.

So, in the end, the thing to do is to assume that you will have a `gdscript` LSP server available (making `mason` redundant), and just configure `nvim-lspconfig` to make neovim aware of it (side stepping the need for `mason-lspconfig`):

```lua
--- kickstarts mason-lspconfig setup
require('mason-lspconfig').setup {
	ensure_installed = {}, -- explicitly set to an empty table (Kickstart populates installs via mason-tool-installer)
	automatic_installation = false,
	handlers = {
		function(server_name)
			local server = servers[server_name] or {}
			print(server_name)
			-- This handles overriding only values explicitly passed
			-- by the server configuration above. Useful when disabling
			-- certain features of an LSP (for example, turning off formatting for ts_ls)
			server.capabilities = vim.tbl_deep_extend('force', {}, capabilities, server.capabilities or {})
			require('lspconfig')[server_name].setup(server)
		end,

-- LOOK HERE: standalone gdscript setup, separate from the other lsps which are configured via mason-lspconfig above
require('lspconfig')['gdscript'].setup {
	name = 'godot',
	cmd = vim.lsp.rpc.connect('127.0.0.1', 6005),
}
```

The above code says "hey I know an LSP exists already, so let's hook up neovim to it on the specified port."
This makes sense because all we need is "hook up neovim," which as mentioned earlier, is the responsibility of `nvim-lspconfig`, not `mason` nor `mason-lspconfig`.


**But I didn't install `gdscript` with `mason` yet?**

Again, you actually don't need to. Usually, you'd need to install the LSP for your language either on it's own through `mason`, or with the convenient auto-setup via `mason-lspconfig`. But `gdscript` language server actually runs in the Godot Editor itself, so (1) you don't install it via `mason`, and (2) `mason-lspconfing` wouldn't even have a pre-config for you.
You just need to have Godot running, and then the server is available if you hook up `nvim` to the godot Language Server port (as described in the article).

---
### Problem 2: opening files from Godot

You can follow the instruction on Simon Dalvai's blog post and it should work.
However, one thing to note is that if you close `nvim` by closing the terminal emulator, it won't actually remove the `server-pipe` file that was created by the above command.

You must close `nvim` explicitly with the `:q` command.

If you forget, and you're left with a lingering `server.pipe` file, then you won't be able to open files from Godot. To workaround this, you can delete the `server.pipe` file and re-run nvim. So double check your project directory if you're unable to open the files from godot in neovim.

---
### Problem 3: Formatting and Linting

I mentioned before that `mason-lspconfig` does not know what `gdscript` is. This is true.
However, it DOES know what `gdtoolkit` is. 

`gdtoolkit` is simply a library that provides a *formatter* and a *linter*. `mason-lspconfig` can indeed install this via the super simple `gdtoolkit = {}` line similar to `ts_ls = {}`.

However, for this to be usable you need to hook up your `nvim` to those tools.

1. formatter
	1. use `conform.nvim` which is provided as part of Kickstart.
		1. locate it in `mason.lua` (at current time of writing)
		2. add to the `formatter_by_ft` configuration:
			1. `gdscript = { 'gdformat' }`
	2. Now you can format `gdscript` in `neovim` with `<leader> + f` in `neovim`
2. lint
	1. Kickstart provides a linter to display lint messages inline already, but it doesn't install/enable it by default.
		1. It's config is located in `/kickstart/plugins/lint.lua`
	2. To install/enable:
		1. navigate to `lazy.lua` and find the commented out `require 'kickstart.plugins.lint`
		2. uncomment it to install it/enable it
		3. in the `lint.lua` file, observe that you need add the linter per language
		4. so, add gdscript linter like below and you're done:
```lua
lint.linters_by_ft = {
	markdown = { 'markdownlint' },
	gdscript = { 'gdlint' },
}
	```

You may find it annoying that the inline linter/formatter warnings overflow off the buffer making them unreadable. 

To address this, I added a keymap that opens a popover diagnostic window to display any of the warnings/errors on the line that your cursor is on. Take a look at the custom keymappings in `init.lua`

```lua
vim.keymap.set('n', '<leader>dd', function()
    return vim.diagnostic.open_float()
end, { noremap = true, silent = true, desc = 'Show diagnostic in popup' })
```
