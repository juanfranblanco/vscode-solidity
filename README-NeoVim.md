# Neovim Setup for VSCode-Solidity LSP

This guide provides step-by-step instructions to set up **Neovim** as a Solidity development environment using the **VSCode-Solidity Language Server**.

## **1. Install Neovim**

### **Windows**
Download and install Neovim from:
- [Neovim Releases](https://github.com/neovim/neovim/releases)

### **Linux/macOS**
```sh
sudo apt install neovim  # Ubuntu/Debian
brew install neovim      # macOS
```

Verify installation:
```sh
nvim --version
```

---
## **2. Install Node.js (Required for Solidity LSP)**

Ensure you have **Node.js** installed:
```sh
node -v
```
If not installed, get it from:
- [Node.js Download](https://nodejs.org/)

For Linux/macOS:
```sh
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 18
```

---
## **3. Install Packer (Neovim Plugin Manager)**

Run the following command in **PowerShell** or **Command Prompt**:
```sh
git clone --depth 1 https://github.com/wbthomason/packer.nvim ^
    %LOCALAPPDATA%\nvim-data\site\pack\packer\start\packer.nvim
```

---
## **4. Configure Neovim (`init.lua`)**

Create the Neovim configuration directory if it doesn't exist:
```sh
mkdir %USERPROFILE%\AppData\Local\nvim\lua
```

Create and open `init.lua`:
```sh
nvim %USERPROFILE%\AppData\Local\nvim\init.lua
```

Paste the following setup:
```lua
-- Ensure packer is installed
local ensure_packer = function()
    local fn = vim.fn
    local install_path = fn.stdpath('data')..'/site/pack/packer/start/packer.nvim'
    if fn.empty(fn.glob(install_path)) > 0 then
        vim.cmd('!git clone --depth 1 https://github.com/wbthomason/packer.nvim '..install_path)
        vim.cmd('packadd packer.nvim')
        return true
    end
    return false
end

ensure_packer()

-- Install plugins
require('packer').startup(function(use)
    use 'wbthomason/packer.nvim' -- Plugin manager
    use 'neovim/nvim-lspconfig'  -- LSP support
    use 'hrsh7th/nvim-cmp'        -- Autocompletion
    use 'hrsh7th/cmp-nvim-lsp'    -- LSP completion source
    use 'williamboman/mason.nvim' -- LSP manager
end)

-- Setup Solidity LSP
local lspconfig = require('lspconfig')

local lspconfig = require('lspconfig')

lspconfig.solidity_ls.setup{
    cmd = { "vscode-solidity-server", "--stdio" },
    filetypes = { "solidity" },
    root_dir = lspconfig.util.root_pattern("hardhat.config.js", "foundry.toml", ".git"),
    settings = {
        solidity = {
            compileUsingRemoteVersion = 'latest',
            defaultCompiler = 'remote',
            enabledAsYouTypeCompilationErrorCheck = true,
        },
    }
}

```
Or Local debug etc

```lua
lspconfig.solidity_ls.setup{
    cmd = {
        "node",
        "--inspect-brk=9229",
        "(%PATH%)vscode-solidity/out/src/server.js",
        "--stdio"
    },
    filetypes = {"solidity"},
    root_dir = lspconfig.util.root_pattern("foundry.toml", "hardhat.config.js", ".git"),
    settings = {
        solidity = {
            compileUsingRemoteVersion = 'latest',
            defaultCompiler = 'remote',
            enabledAsYouTypeCompilationErrorCheck = true,
        },
    }
}
```

Save the file and exit Neovim.

---
## **5. Install Plugins**
Open Neovim and run:
```sh
:PackerSync
```

---
## **6. Verify Solidity LSP is Working**
### **Start Neovim with a Solidity File**
```sh
nvim test.sol
```

### **Check Active LSPs**
```sh
:LspInfo
```
You should see `solidity_ls` running.

### **Test Autocompletion**
Start typing a Solidity function or keyword and press:
```sh
<C-Space>
```

### **Restart LSP if Needed**
```sh
:LspRestart
```

---
## **7. Useful Commands**
| Command | Action |
|---------|--------|
| `gd` | Go to definition |
| `gr` | Find references |
| `K` | Show documentation |
| `<C-Space>` | Trigger autocomplete |
| `:LspInfo` | Show LSP status |
| `:LspRestart` | Restart LSP |

---
## **8. Debugging LSP**
If LSP is not working, check logs:
```sh
:lua print(vim.inspect(vim.lsp.get_active_clients()))
```
Or manually start the Solidity LSP:
```sh
node --inspect-brk=9229 (PATH)vscode-solidity/out/src/server.js --stdio
```

---
### 🎉 **Neovim is now fully configured for Solidity development!** 🚀