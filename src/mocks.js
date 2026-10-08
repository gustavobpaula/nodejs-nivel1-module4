import { faker } from "@faker-js/faker";

export function generateUser() {
  return {
    ip: faker.internet.ip(),
    username: faker.internet.userName(),
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    email: faker.internet.email(),
    location: faker.location.city(),
    job_area: faker.person.jobArea(),
    company: faker.company.name(),
    job_title: faker.person.jobTitle(),
  };
}

export function generateLogEntry(user) {
  return {
    ...user,
    id: faker.string.uuid(),
    timestamp: faker.date.recent().toISOString(),
  };
}
