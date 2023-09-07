import { Box, Typography } from "@mui/material";
import { cyan, blue, deepPurple, pink } from "@mui/material/colors";

const styles = {
  root: {
    backgroundColor: blue[600],
    height: 50,
  },
};

export default function Menu() {
  return (
    <Box sx={styles.root}>
      <Typography></Typography>
    </Box>
  );
}
