"use client";
import { Box, Slide, Typography } from "@mui/material";
import { cyan, blue, deepPurple, pink } from "@mui/material/colors";

const styles = {
  root: {
    backgroundColor: blue[700],
    height: `calc(100vh - 50px)`,
  },
};

interface Prop {
  profile?: Profile;
}

export default function Chat({ profile }: Prop) {
  return (
    <Box sx={styles.root}>
      <Slide direction="left" in={true} mountOnEnter unmountOnExit>
        <Box
          sx={{ border: 2, borderColor: "#ffffff33" }}
          width={"100%"}
          height={"100%"}
        >
          <Typography>Hello</Typography>
        </Box>
      </Slide>
    </Box>
  );
}
