import { useMutation } from "@apollo/client";
import {
  Button,
  TextField,
  CircularProgress,
  Alert,
  Box,
} from "@mui/material";
import { useState } from "react";
import { ADD_CAR, GET_CARS } from "@/graphql/queries";

export default function AddCarForm() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [color, setColor] = useState("");

  const [addCar, { loading, error }] = useMutation(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (make && model && year && color) {
      try {
        await addCar({ variables: { make, model, year: Number(year), color } });
        setMake("");
        setModel("");
        setYear("");
        setColor("");
      } catch (err) {
        // Error handling can be improved here if needed
      }
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <TextField
        label="Make"
        value={make}
        onChange={(e) => setMake(e.target.value)}
        fullWidth
        required
        margin="normal"
      />
      <TextField
        label="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        fullWidth
        required
        margin="normal"
      />
      <TextField
        label="Year"
        value={year}
        onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
        type="number"
        fullWidth
        required
        margin="normal"
      />
      <TextField
        label="Color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        fullWidth
        required
        margin="normal"
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? <CircularProgress size={24} /> : "Add Car"}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error.message}</Alert>}
    </Box>
  );
}
