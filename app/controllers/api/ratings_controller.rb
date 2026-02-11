module Api
  class RatingsController < ApplicationController
    before_action :authenticate!

    # POST /api/notes/:note_id/ratings
    def create
      note = Note.find(params[:note_id])
      rating = current_user.ratings.find_or_initialize_by(note: note)
      rating.helpfulness = params[:helpfulness]

      if rating.save
        render json: {
          id: rating.id,
          helpfulness: rating.helpfulness,
          note: {
            id: note.id,
            helpful_count: note.reload.helpful_count,
            somewhat_count: note.somewhat_count,
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
