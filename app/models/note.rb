class Note < ApplicationRecord
  belongs_to :author, class_name: "User"
  belongs_to :page
  has_many :ratings, dependent: :destroy

  enum :status, { pending: 0, helpful: 1, not_helpful: 2 }

  validates :body, presence: true
  validates :selected_text, presence: true

  def update_status!
    positive_count = helpful_count + somewhat_count
    if positive_count >= 3 && positive_count > not_helpful_count * 2
      update!(status: :helpful)
    elsif not_helpful_count >= 3 && not_helpful_count > positive_count * 2
      update!(status: :not_helpful)
    end
  end
end
