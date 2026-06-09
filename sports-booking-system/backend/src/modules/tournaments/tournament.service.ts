import { NotFoundError } from "../../shared/errors/AppError.js";
import { tournamentRepository } from "./tournament.repository.js";

export const tournamentService = {
  list() {
    return tournamentRepository.listPublic();
  },

  async detail(slug: string) {
    const [tournament] = await tournamentRepository.findPublicBySlug(slug);
    if (!tournament) throw new NotFoundError("Khong tim thay giai dau");
    return tournament;
  }
};
