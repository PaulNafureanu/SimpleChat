import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Typography,
} from "@mui/material";
import getConversations from "../../services/getConversations";
import Conversation from "./conversation";
import { cyan, blue, deepPurple, pink } from "@mui/material/colors";

interface Props {
  id: number;
  label: string;
  conversations: number[];
}

const styles = { root: { backgroundColor: blue[800] } };

export default function Category({ id, label }: Props) {
  // Simulate getting conversations from the db/backend
  const conversations = getConversations({ byCategory: [id] });

  const isFavourite = "Favourites" === label;

  return (
    <Accordion
      sx={styles.root}
      defaultExpanded={isFavourite}
      square={isFavourite}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon color="info" />}
        aria-controls={`accordion-cat${id}`}
        id={`accordion-cat${id}`}
      >
        <Typography>{label}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid
          container
          rowSpacing={2}
          direction="row"
          justifyContent="center"
          alignItems="flex-start"
        >
          {conversations.map((conversation) => (
            <Grid item xs={4} sm={3} md={4} key={conversation.id}>
              <Conversation {...conversation} />
            </Grid>
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}
