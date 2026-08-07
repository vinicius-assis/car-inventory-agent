import { useQuery } from "@apollo/client";
import { GET_CARS } from "@/graphql/queries";
import type { Car } from "@/types";

interface UseCarsResult {
  cars: Car[] | undefined;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Custom hook to fetch the list of cars.
 * Uses Apollo Client's useQuery to execute the GET_CARS query.
 * Returns an object containing the cars data, loading state, and error information.
 */
export default function useCars(): UseCarsResult {
  const { data, loading, error } = useQuery<{ cars: Car[] }>(GET_CARS);

  return {
    cars: data?.cars,
    loading,
    error,
  };
}
