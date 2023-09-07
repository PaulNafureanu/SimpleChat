import Chat from "@/components/chat/chat";
import Conversations from "@/components/conversations/conversations";
import Menu from "@/components/menu/menu";
import { Box, Grid } from "@mui/material";

const styles = {
  root: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
  },
};

export default function Home() {
  return (
    <Box sx={styles.root}>
      <Grid container>
        <Grid item xs={12}>
          <Menu />
        </Grid>
        <Grid item xs={12} md={4}>
          <Conversations />
        </Grid>
        <Grid item md={8}>
          <Chat />
        </Grid>
      </Grid>
    </Box>
  );
}
