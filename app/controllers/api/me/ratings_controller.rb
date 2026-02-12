module Api
  module Me
    class RatingsController < ApplicationController
      before_action :authenticate!

      def index
        ratings = current_user.ratings.includes(note: :author).order(created_at: :desc)
        render json: ratings.map { |r|
          { id: r.id, helpfulness: r.helpfulness, note_id: r.note_id,
            note_body: r.note.body, note_author: r.note.author.twitter_handle,
            created_at: r.created_at.iso8601 }
        }
      end
    end
  end
end
