-- Use the SDK belonging to the buffer's project, without activating its environment.
local function mojo_tool(name, start)
  local dir = start or vim.uv.cwd()
  while dir do
    local executable = vim.fs.joinpath(dir, ".venv", "bin", name)
    if vim.fn.executable(executable) == 1 then
      return executable
    end
    local parent = vim.fs.dirname(dir)
    dir = parent ~= dir and parent or nil
  end
  return vim.fn.exepath(name) ~= "" and vim.fn.exepath(name) or name
end

return {
  {
    "folke/noice.nvim",
    opts = function(_, opts)
      opts.routes = opts.routes or {}
      table.insert(opts.routes, 1, {
        -- Mojo reports document analysis on every edit; keep this out of the UI.
        filter = {
          event = "lsp",
          kind = "progress",
          cond = function(message)
            return vim.tbl_get(message.opts, "progress", "client") == "mojo"
          end,
        },
        opts = { skip = true },
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        mojo = {
          mason = false,
          root_markers = { "pyproject.toml", "pixi.toml", ".git" },
          cmd = function(dispatchers, config)
            return vim.lsp.rpc.start({ mojo_tool("mojo-lsp-server", config.root_dir), "--log=error" }, dispatchers, {
              cwd = config.root_dir,
              env = config.cmd_env,
              detached = config.detached,
            })
          end,
        },
      },
    },
  },
  {
    "nvim-treesitter/nvim-treesitter",
    init = function()
      vim.api.nvim_create_autocmd("User", {
        pattern = "TSUpdate",
        group = vim.api.nvim_create_augroup("mojo_treesitter", { clear = true }),
        callback = function()
          -- Mojo 1.0 grammar and matching highlights, pinned to release v1.0.4.
          require("nvim-treesitter.parsers").mojo = {
            install_info = {
              url = "https://github.com/dmitry-salin/tree-sitter-mojo",
              revision = "68bb75b6fe5135ef0223f362e1c05d0dca6f9dfc",
              queries = "nvim-queries/mojo",
            },
          }
        end,
      })
    end,
    opts = { ensure_installed = { "mojo" } },
  },
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = { mojo = { "mojo_format" } },
      formatters = {
        mojo_format = {
          command = function(_, ctx)
            return mojo_tool("mojo", vim.fs.dirname(ctx.filename))
          end,
        },
      },
    },
  },
}
