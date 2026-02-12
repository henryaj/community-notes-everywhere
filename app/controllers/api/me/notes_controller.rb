module Api
  module Me
    class NotesController < ApplicationController
      before_action :authenticate!

      def index
        notes = current_user.notes.includes(:page).order(created_at: :desc)
        render json: notes.map { |n|
          { id: n.id, body: n.body, status: n.status, page_url: n.page.url, created_at: n.created_at.iso8601 }
        }
      end
    end
  end
end
