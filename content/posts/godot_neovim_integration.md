+++
title = "My Godot and Neovim Setup"
description = "How I setup Godot Engine to work seamlessly with Neovim as an external editor."
tags = ["godot", "neovim", "fish", "ghostty", "linux"]
date = 2025-10-10
+++


# Environment

| Component Type    | Component Value                                 | Notes                                                                                                                      |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Linux Distro      | [Endeavor OS (GNOME)](https://endeavouros.com/) | All of the linux packages mentioned in this document are native `pacman` packages (official maintained ones, not from AUR) |
| Terminal Emulator | [Ghostty](https://ghostty.org/)                 |                                                                                                                            |
| Shell             | [Fish](https://fishshell.com/)                  |                                                                                                                            |

This article assumes an `nvim` setup based on Kickstart.Nvim similar to as described in [[KickStart Neovim Notes]].

# Goals

1. Open scripts that are clicked from Godot Engine in neovim
2. Support LSP features for autocomplete, go-to references, etc.
3. Godot Engine documentation references in neovim
4. Formatting
5. Linting

tldr;

Do mostly what this guy did: [Neovim As External Editor for Godot](https://simondalvai.org/blog/godot-neovim/)

But there were some caveats.

### Caveat 1: mason-lspconfig

I wasn't able to get the lsp working via `mason-lspconfig` because `mason-lspconfig` does not have a pre-configuration mapping, or knowledge, to `gdscript` language server.

Now, `mason-lspconfig` is basically just a convenience which bridges the gap between `mason` and `nvim-lspconfig`. Their purposes are respectively:
1. `mason` - managing packages for lsp by downloading them and installing them
2. `nvim-lspconfig` - configuring and _enabling_ these lsps for nvim to use 

`mason-lspconfig` just makes it easier to do all of the above in one step (install, enable, configure). However, it doesn't know how to handle `gdscript`. 

Kickstart is a little misleading here as the `mason-config` lines have comments saying, that you can do `:help lspconfig-all` to see all the pre-configured languages. If you do so, then `gdscript` actually does show up. 

However this list is only describing the pre-configured `nvim-lspconfig` language servers. Has nothing to do with `mason-lspconfig`, which itself doesn't have a mapping from `mason` to `nvim-lspconfig`'s managed gdscript language server. 

If you do attempt to set up `gdscript` via `mason-lspconfig`, then you'll get an error saying that `gdscript` package was not found. 

My guess as to why is that the `mason-lspconfig` are aware of the fact that Godot itself runs the language server already, so they didn't bother with implementing a bridge to `nvim-lspconfig` for a language server that most people won't even install via `mason`. (See below Note: "But I didn't install gdscript with mason yet?")

In other words, why create a convenient auto setup from `mason` to `nvim-lspconfig` for a language that nobody will, or should, install via `mason` in the first place. `mason` is out of the loop.

So, in the end, the thing to do is to just ignore `mason-lspconfig` and add this as a standalone `nvim-lspconfig` configuration AFTER the `mason-lspconfig` setup:

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

Once you do the above, then then all you need to do is follow the other instruction on the blog post above.

> [!NOTE] But I didn't install `gdscript` with `mason` yet?
> You don't need to actually. Usually, you'd need to install the LSP for your language either on it's own through `mason`, or with the convenient auto-setup via `mason-lspconfig`. But `gdscript` language server actually runs in the Godot Editor itself, so (1) you don't install it via `mason`, and (2) `mason-lspconfing` wouldn't even have a pre-config for you.
>  You just need to have Godot running, and then the server is available if you hook up `nvim` to the godot Language Server port (as described in the article).


### Caveat 2: opening files from Godot

You can follows the instruction on the blog post and it should work.
However, one thing is that if you close `nvim` by just closing the terminal, it won't actually remove the server-pipe file.

You must close `nvim` explicitly with the `:q` command.
If you close Ghostty on it's own, it won't clean up the `server.pipe` file for some reason.

If you forget, and you're left with a lingering `server.pipe` file, then you won't be able to open files from Godot. To workaround this, you can delete the `server.pipe` file and re-run nvim.

### Caveat 3: Formatting and Linting

I mentioned before that `mason-lspconfig` does not know what `gdscript` is. This is true.
However, it DOES know what `gdtoolkit` is. 

`gdtoolkit` is simply a library that provides a formatter and a linter. `mason-lspconfig` can indeed install this via the super simple `gdtoolkit = {}` line similar to `ts_ls = {}`.

However, for this to be usable you need to hook up your `nvim` to those tools.

1. formatter
	1. use `conform.nvim` which is provided as part of Kickstart.
		1. locate it in `mason.lua` (at current time of writing)
		2. add to the `formatter_by_ft` configuration:
			1. `gdscript = { 'gdformat' }`
	2. Now you can format `gdscript` in `neovim` with `space + f` in `neovim`
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

> [!NOTE] Inline Linting overflow off the buffer
> To address this I added a keymap that opens a popover diagnostic window to display any of the warnings/errors on the line that your cursor is on. Take a look at the custom keymappings in `init.lua`

---


{% chart() %}
{
  "type": "Line",
  "title": "Monthly income of an indie developer",
  "xLabel": "Month",
  "yLabel": "$ Dollars",
  "data": {
    "labels": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "datasets": [
      {
        "label": "Plan",
        "data": [30, 70, 200, 300, 500, 800, 1500, 2900, 5000, 8000]
      },
      {
        "label": "Reality",
        "data": [0, 1, 30, 70, 80, 100, 50, 80, 40, 150]
      }
    ]
  }
}
{% end %}

