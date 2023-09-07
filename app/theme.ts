import { createTheme } from "@mui/material";

const theme = createTheme({
  components: { MuiTypography: { defaultProps: { color: "white" } } },
});

export default theme;
