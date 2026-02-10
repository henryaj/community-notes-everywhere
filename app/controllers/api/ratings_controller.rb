module Api
  class RatingsController < ApplicationController
    before_action :authenticate!

    # POST /api/notes/:note_id/ratings
    def create
      note = Note.find(params[:note_id])
      rating = current_user.ratings.find_or_initialize_by(note: note)
      rating.helpful = params[:helpful]

      if rating.save
        render json: {
          id: rating.id,
          helpful: rating.helpful,
          note: {
            id: note.id,
            helpful_count: note.reload.helpful_count,
            not_helpful_count: note.not_helpful_count,
            status: note.status
          }
        }, status: rating.previously_new_record? ? :created : :ok
      else
        render json: { errors: rating.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end
end
