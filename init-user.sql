DELETE FROM public.users;
INSERT INTO public.users (id, email, password, created_at) VALUES 
('11111111-1111-1111-1111-111111111111', 'admin@caca.local', '$2b$10$6FKWItYtZts5vi9APD26ROnk6KMXBDi3.lnMD0hg7pfWjywLRNkVK', NOW());
