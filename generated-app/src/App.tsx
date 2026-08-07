import React from "react";
import { Container, Box, Typography, Divider } from "@mui/material";
import CarList from "./components/CarList";
import AddCarForm from "./components/AddCarForm";

const App: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Car Management
        </Typography>
        <AddCarForm />
        <Divider sx={{ my: 4 }} />
        <CarList />
      </Box>
    </Container>
  );
};

export default App;
