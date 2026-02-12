module Api
  class RatingsController < ApplicationController
    before_action :authenticate!
    before_action :require_rating_reputation!

    # POST /api/notes/:note_id/ratings
    def create
      note = Note.find(params[:note_id])

      if note.author_id == current_user.id
        return render json: { error: "You cannot rate your own notes" }, status: :forbidden
      end

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
          },
          transparency: note.transparency_data
        }, status: rating.previously_new_record? ? :created : :ok
      else
        render json: { errors: rating.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def require_rating_reputation!
      unless current_user.can_rate?
        render json: { error: "You need a reputation score of at least #{User::MIN_RATING_REPUTATION} to rate notes" }, status: :forbidden
      end
    end
  end
end
