class AddRatingImpactToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :rating_impact, :float, default: 0.0, null: false
  end
end
