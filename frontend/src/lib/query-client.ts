import { QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof Error) {
          toast.error(error.message)
        }
      },
    },
  },
})
