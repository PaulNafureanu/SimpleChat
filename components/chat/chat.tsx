import { Box, Slide, Typography } from "@mui/material";
import { cyan, blue, deepPurple, pink } from "@mui/material/colors";

const styles = {
  root: {
    backgroundColor: blue[700],
    height: `calc(100vh - 50px)`,
  },
};

interface Prop {}

export default function Chat(props: Prop) {
  return (
    <Box sx={styles.root}>
      <Slide direction="left" in={false} mountOnEnter unmountOnExit>
        <Box
          sx={{ border: 2, borderColor: "#ffffff33" }}
          width={"100%"}
          height={"100%"}
        >
          <Typography>{`Hello Conversation`}</Typography>
        </Box>
      </Slide>
    </Box>
  );
}
