import Chat from "@/components/chat/chat";
import Conversations from "@/components/conversations/conversations";
import Menu from "@/components/menu/menu";
import { ProfileSerializer } from "@/db/Serializer";
import { getXataClient } from "@/db/xata";
import { Box, Grid } from "@mui/material";

const xata = getXataClient();

const styles = {
  root: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
  },
};

export default async function Home() {
  const demoProfileId = "rec_cjt03igdho96l57bv0a0";
  const demoProfile = await xata.db.Profiles.read(demoProfileId);

  let profile: Profile | undefined;
  if (demoProfile) profile = ProfileSerializer(demoProfile);
  console.log("Server: ", profile);

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
          <Chat profile={profile} />
        </Grid>
      </Grid>
    </Box>
  );
}
