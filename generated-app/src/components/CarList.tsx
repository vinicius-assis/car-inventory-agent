import React, { useState, useMemo } from "react";
import { CircularProgress, Alert, TextField, MenuItem, Select, InputLabel, FormControl } from "@mui/material";
import useCars from "@/hooks/useCars";
import CarCard from "./CarCard";
import type { Car } from "@/types";

interface SortOption {
  value: keyof Omit<Car, 'id' | 'mobile' | 'tablet' | 'desktop'>;
  label: string;
}

const sortOptions: SortOption[] = [
  { value: "year", label: "Year" },
  { value: "make", label: "Make" },
];

const sortCars = (cars: Car[], criteria: keyof Omit<Car, 'id' | 'mobile' | 'tablet' | 'desktop'>) => {
  return [...cars].sort((a, b) => {
    if (a[criteria] < b[criteria]) return -1;
    if (a[criteria] > b[criteria]) return 1;
    return 0;
  });
};

const filterCars = (cars: Car[], searchTerm: string) => {
  return cars.filter((car) =>
    car.model.toLowerCase().includes(searchTerm.toLowerCase())
  );
};

const CarList: React.FC = () => {
  const { cars, loading, error } = useCars();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCriteria, setSortCriteria] = useState<keyof Omit<Car, 'id' | 'mobile' | 'tablet' | 'desktop'>>("year");

  const filteredAndSortedCars = useMemo(() => {
    if (!cars) return [];
    const filtered = filterCars(cars, searchTerm);
    return sortCars(filtered, sortCriteria);
  }, [cars, searchTerm, sortCriteria]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <div>
      <TextField
        label="Search by model"
        variant="outlined"
        fullWidth
        margin="normal"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <FormControl fullWidth margin="normal">
        <InputLabel>Sort by</InputLabel>
        <Select
          value={sortCriteria}
          onChange={(e) => setSortCriteria(e.target.value as keyof Omit<Car, 'id' | 'mobile' | 'tablet' | 'desktop'>)}
          label="Sort by"
        >
          {sortOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {filteredAndSortedCars.map((car) => (
        <CarCard key={car.id} car={car} />
      ))}
    </div>
  );
};

export default CarList;
