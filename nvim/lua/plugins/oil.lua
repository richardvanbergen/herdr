return {
  "stevearc/oil.nvim",
  --@module 'oil'
  --@type oil.SetupOpts
  opts = {},
  dependencies = { { "nvim-mini/mini.icons", opts = {} } },
  lazy = false,
  keys = {
    { "-", "<cmd>Oil<cr>", mode = { "n" }, desc = "Open parent directory" },
  },
}
